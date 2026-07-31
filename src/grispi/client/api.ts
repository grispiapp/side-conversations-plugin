import { Attachments } from "./attachments";
import { Authentication } from "./authentication";
import { Customers } from "./customers";
import { HttpHandler } from "./http-handler";
import { Tickets } from "./tickets";
import { Users } from "./users";

export class GrispiAPI {
  private httpHandler: HttpHandler;
  readonly authentication: Authentication;
  readonly tickets: Tickets;
  readonly users: Users;
  readonly customers: Customers;
  readonly attachments: Attachments;

  constructor() {
    this.httpHandler = new HttpHandler();
    this.authentication = new Authentication(this.httpHandler);
    this.tickets = new Tickets(this.httpHandler, this.authentication);
    this.users = new Users(this.httpHandler, this.authentication);
    this.customers = new Customers(this.httpHandler, this.authentication);
    this.attachments = new Attachments(this.httpHandler, this.authentication);
  }
}

export const grispiAPI = new GrispiAPI();
