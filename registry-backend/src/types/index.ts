import type * as Privy from '@privy-io/server-auth';
import type * as ShinkaiDB from './shinkai_db.js';

type PrivyUser = Privy.User;
type User = ShinkaiDB.User;
type Product = ShinkaiDB.Product;
type Order = ShinkaiDB.Order;

export type { PrivyUser, User, Product, Order };