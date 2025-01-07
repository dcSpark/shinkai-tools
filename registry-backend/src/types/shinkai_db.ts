type User = {
    id: string;
    email: string;
    name: string;
    phone: string;
    wallet: any;
  }
  
  type Product = {
    id: string;
    name: string;
    author: string;
    description: string;
    type: string;
    tool_language: string;
    version: string;
    router_key: string;
    hash: string;
    file: string;
    is_default: boolean;
    keywords: string;
  }
  
  type Order = {
    id: string;
    user_id: string;
    product_id: string;
    created_at: string;
  }

  export type { User, Product, Order };