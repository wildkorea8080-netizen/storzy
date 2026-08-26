import{lookup}from"node:dns/promises";import{isIP}from"node:net";import{DomainError}from"../brand/errors.js";import type{PreviewDesignUploadService}from"./preview-upload-service.js";
export type DesignFileMetadata=Readonly<{url:string;mimeType:"image/png"|"image/jpeg";sizeBytes:number;widthPx:number;heightPx:number}>;
export interface DesignFileInspector{inspect(url:string):Promise<DesignFileMetadata>}
type Resolver=(hostname:string)=>Promise<readonly string[]>;
const MAX_BYTES=50*1024*1024,MAX_PIXELS=20_000,HEADER_BYTES=65_536,ALLOWED=new Set(["image/png","image/jpeg"]);

export class PreviewDesignFileInspector implements DesignFileInspector {
  constructor(private readonly uploads?:PreviewDesignUploadService){}
  async inspect(raw:string):Promise<DesignFileMetadata>{
    const url=new URL(raw);
    if(url.protocol==="https:"&&url.hostname==="preview-assets.storzy.local"&&url.pathname.startsWith("/uploads/")&&this.uploads){const item=await this.uploads.inspect(url.toString());return{url:item.fileUrl,mimeType:item.mimeType,sizeBytes:item.sizeBytes,widthPx:item.widthPx,heightPx:item.heightPx}}
    if(url.protocol!=="https:"||url.hostname!=="preview-assets.storzy.local"||url.pathname!=="/seoul-side-design.png")throw invalid("Preview mode only accepts a bundled sample or uploaded STORZY design URL");
    return{url:url.toString(),mimeType:"image/png",sizeBytes:1_048_576,widthPx:3000,heightPx:3000};
  }
}

export class HttpDesignFileInspector implements DesignFileInspector{
  constructor(private readonly fetcher:typeof fetch=globalThis.fetch,private readonly resolver:Resolver=async hostname=>(await lookup(hostname,{all:true})).map(x=>x.address)){}
  async inspect(raw:string){if(raw.length>1000)throw invalid("Design URL exceeds 1000 characters");let url=new URL(raw);
    for(let redirects=0;redirects<=3;redirects++){await this.assertPublic(url);const response=await this.fetcher(url,{method:"GET",redirect:"manual",headers:{Range:`bytes=0-${HEADER_BYTES-1}`},signal:AbortSignal.timeout(10_000)});
      if([301,302,303,307,308].includes(response.status)){const location=response.headers.get("location");if(!location||redirects===3)throw invalid("Design URL has too many redirects");url=new URL(location,url);continue}
      if(response.status!==200&&response.status!==206)throw invalid(`Design file returned HTTP ${response.status}`);
      const mimeType=(response.headers.get("content-type")??"").split(";",1)[0]!.trim().toLowerCase();if(!ALLOWED.has(mimeType))throw invalid("Design file must be PNG or JPEG");
      const range=response.headers.get("content-range"),rangeSize=range?.match(/\/(\d+)$/)?.[1],length=rangeSize??response.headers.get("content-length"),sizeBytes=Number(length);if(!Number.isSafeInteger(sizeBytes)||sizeBytes<=0)throw invalid("Design file size is unavailable");if(sizeBytes>MAX_BYTES)throw invalid("Design file exceeds 50 MB");
      const prefix=await readPrefix(response,HEADER_BYTES),dimensions=mimeType==="image/png"?pngDimensions(prefix):jpegDimensions(prefix);if(!dimensions)throw invalid("Design file content does not match its PNG or JPEG type");
      if(dimensions.widthPx>MAX_PIXELS||dimensions.heightPx>MAX_PIXELS)throw invalid("Design image dimensions exceed 20,000 pixels");
      return{url:url.toString(),mimeType:mimeType as DesignFileMetadata["mimeType"],sizeBytes,...dimensions};
    }throw invalid("Design URL could not be inspected")
  }
  private async assertPublic(url:URL){if(url.protocol!=="https:"||url.username||url.password||url.port)throw invalid("Design URL must use standard HTTPS without credentials");const addresses=isIP(url.hostname)?[url.hostname]:await this.resolver(url.hostname);if(!addresses.length||addresses.some(privateAddress))throw invalid("Design URL must resolve to a public address")}
}

async function readPrefix(response:Response,max:number){if(!response.body)throw invalid("Design file body is unavailable");const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;try{while(total<max){const{done,value}=await reader.read();if(done)break;if(value){const take=value.subarray(0,Math.min(value.length,max-total));chunks.push(take);total+=take.length;if(take.length<value.length)break}}}finally{await reader.cancel()}const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}return result}
function pngDimensions(data:Uint8Array){const signature=[137,80,78,71,13,10,26,10];if(data.length<24||!signature.every((value,index)=>data[index]===value)||String.fromCharCode(...data.slice(12,16))!=="IHDR")return null;const view=new DataView(data.buffer,data.byteOffset,data.byteLength),widthPx=view.getUint32(16),heightPx=view.getUint32(20);return widthPx&&heightPx?{widthPx,heightPx}:null}
function jpegDimensions(data:Uint8Array){if(data.length<4||data[0]!==0xff||data[1]!==0xd8)return null;let i=2;while(i+8<data.length){if(data[i]!==0xff){i++;continue}const marker=data[i+1]!;if(marker===0xd9||marker===0xda)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){i+=2;continue}const length=(data[i+2]!<<8)|data[i+3]!;if(length<2||i+2+length>data.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){const heightPx=(data[i+5]!<<8)|data[i+6]!,widthPx=(data[i+7]!<<8)|data[i+8]!;return widthPx&&heightPx?{widthPx,heightPx}:null}i+=2+length}return null}
function invalid(message:string){return new DomainError("INVALID_DESIGN_FILE",message)}
function privateAddress(value:string){const lower=value.toLowerCase();if(lower==="::1"||lower==="::"||lower.startsWith("fe80:")||lower.startsWith("fc")||lower.startsWith("fd"))return true;const ipv4=lower.startsWith("::ffff:")?lower.slice(7):value,parts=ipv4.split(".").map(Number);if(parts.length!==4)return false;const a=parts[0]!,b=parts[1]!;return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)}
