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
    description: string;
    price: number;
  }
  
  type Order = {
    id: string;
    user_id: string;
    product_id: string;
    created_at: string;
  }

  export type { User, Product, Order };