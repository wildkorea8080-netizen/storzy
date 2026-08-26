import {DomainError} from "../brand/errors.js";
import {ShopifyAdminClient} from "./shopify.js";

export const SHOPIFY_ORDER_WEBHOOK_TOPICS=["ORDERS_CREATE","ORDERS_PAID","ORDERS_UPDATED","ORDERS_CANCELLED"] as const;
export const SHOPIFY_APP_WEBHOOK_TOPICS=["APP_UNINSTALLED"] as const;
const LIST=`#graphql
query StorzyWebhookSubscriptions($topics:[WebhookSubscriptionTopic!]!,$uri:String!){webhookSubscriptions(first:100,topics:$topics,uri:$uri){nodes{id topic uri}}}`;
const CREATE=`#graphql
mutation StorzyWebhookSubscriptionCreate($topic:WebhookSubscriptionTopic!,$webhookSubscription:WebhookSubscriptionInput!){webhookSubscriptionCreate(topic:$topic,webhookSubscription:$webhookSubscription){webhookSubscription{id topic uri} userErrors{field message}}}`;

export async function syncShopifyOrderWebhooks(input:{shopDomain:string;accessToken:string;apiVersion:string;publicAppUrl:string;fetch?:typeof globalThis.fetch}){
  let orderEndpoint:URL,uninstallEndpoint:URL;
  try{orderEndpoint=new URL("/webhooks/shopify/orders",input.publicAppUrl);uninstallEndpoint=new URL("/webhooks/shopify/app-uninstalled",input.publicAppUrl);}catch{throw new DomainError("INVALID_INPUT","PUBLIC_APP_URL이 올바르지 않습니다.");}
  if(orderEndpoint.protocol!=="https:"||uninstallEndpoint.protocol!=="https:")throw new DomainError("WEBHOOK_PUBLIC_HTTPS_REQUIRED","Shopify Webhook 등록에는 공개 HTTPS 주소가 필요합니다.");
  const client=new ShopifyAdminClient({shopDomain:input.shopDomain,accessToken:input.accessToken,apiVersion:input.apiVersion,...(input.fetch?{fetch:input.fetch}:{})});
  const specs=[{topics:SHOPIFY_ORDER_WEBHOOK_TOPICS,endpoint:orderEndpoint},{topics:SHOPIFY_APP_WEBHOOK_TOPICS,endpoint:uninstallEndpoint}] as const;
  const existing=new Map<string,{id:string;topic:string;uri:string}>();
  const created:Array<{id:string;topic:string;uri:string}>=[];
  for(const spec of specs){const listed=await client.graphql<{webhookSubscriptions:{nodes:Array<{id:string;topic:string;uri:string}>}}>(LIST,{topics:spec.topics,uri:spec.endpoint.href});for(const item of listed.webhookSubscriptions.nodes.filter(item=>item.uri===spec.endpoint.href))existing.set(item.topic,item);for(const topic of spec.topics){
      if(existing.has(topic))continue;
      const result=await client.graphql<{webhookSubscriptionCreate:{webhookSubscription:{id:string;topic:string;uri:string}|null;userErrors:Array<{field:string[]|null;message:string}>}}>(CREATE,{topic,webhookSubscription:{uri:spec.endpoint.href,format:"JSON"}}),payload=result.webhookSubscriptionCreate;
      if(payload.userErrors.length||!payload.webhookSubscription)throw new DomainError("PROVIDER_VALIDATION_FAILED",payload.userErrors.map(error=>error.message).join("; ")||`${topic} Webhook 등록에 실패했습니다.`);
      created.push(payload.webhookSubscription);
    }
  }
  const topics=[...SHOPIFY_ORDER_WEBHOOK_TOPICS,...SHOPIFY_APP_WEBHOOK_TOPICS];
  return{provider:"SHOPIFY" as const,endpoint:orderEndpoint.href,endpoints:{orders:orderEndpoint.href,appUninstalled:uninstallEndpoint.href},topics,total:topics.length,created:created.length,existing:topics.length-created.length,subscriptions:[...existing.values(),...created]};
}
