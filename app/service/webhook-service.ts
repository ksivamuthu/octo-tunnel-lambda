import { APIGatewayEvent, SQSEvent } from "aws-lambda";
import { SQS } from "aws-sdk";

import axios, { AxiosResponse } from "axios";
import crypto from "crypto";
import { urlJoin } from "url-join-ts";
import config from "../config.json";
import { WebHookServiceItem } from "../utils/config";
import { TError } from "../utils/error";
import { getProperty } from "../utils/helper";

const token = process.env.GITHUB_WEBHOOK_SECRET || "some";
const sqs = new SQS({
  apiVersion: "latest",
  region: process.env.AWS_REGION,
});
export class WebHookService {
  async healthCheck(_event: APIGatewayEvent, _context: any) {
    if (!token) throw new TError("Webhook secret is not set");
    if (!config) throw new TError("Config is not set");
    return "OK";
  }

  async handleAsync(event: APIGatewayEvent, _context: any) {
    this.validateRequest(event);
    const eventType = getProperty(event.headers, "x-github-event");

    // Handle the ping event
    if (eventType === "ping") return { message: "pong" };

    const params = {
      MessageBody: JSON.stringify({
        target: event.pathParameters.targetId,
        proxy: event.pathParameters.proxy,
        headers: event.headers,
        query: event.queryStringParameters,
        body: event.body,
      }),
      QueueUrl: process.env.SQS_QUEUE_URL,
    };

    console.log(params);

    return await sqs
      .sendMessage(params)
      .promise()
      .then(() => {
        return "Successfully sent webhook to SQS";
      })
      .catch(this.handleError);
  }

  async handleSync(event: APIGatewayEvent, _context: any) {
    // Validate the request and signature
    this.validateRequest(event);

    const eventType = getProperty(event.headers, "x-github-event");

    // Handle the ping event
    if (eventType === "ping") return { message: "pong" };

    // Find the target
    const target = this.findTarget(event.pathParameters.targetId);
    const url = urlJoin(target.baseUrl, event.pathParameters.proxy);
    console.log(`Forwarding webhook to ${target.baseUrl}`);

    // Forward the webhook
    return await axios
      .post(url, event.body, {
        headers: { ...event.headers, ...{ Host: "*.github.com" } },
        params: event.queryStringParameters,
      })
      .then(this.handleSuccess)
      .catch(this.handleError);
  }

  async processTarget(event: SQSEvent, _context: any) {
    for (const message of event.Records) {
      const data = JSON.parse(message.body);
      const target = this.findTarget(data.target);
      const url = urlJoin(target.baseUrl, data.proxy);
      console.log(`Forwarding webhook to ${target.baseUrl}`);

      // Forward the webhook
      await axios
        .post(url, data.body, {
          headers: { ...data.headers, ...{ Host: "*.github.com" } },
          params: data.query,
        })
        .catch(this.handleError);
    }
  }

  // Handle the success response
  handleSuccess(resp: AxiosResponse) {
    console.log(`Successfully sent webhook to ${resp.config.url}`);
    return { message: `Successfully sent webhook to ${resp.config.url}` };
  }

  // Handle the error response
  handleError(error) {
    console.error(error);
    throw error;
  }

  // Validate GitHub webhook signature
  validateSignature(signature: string, body: string) {
    const calculatedHash = `sha256=${crypto
      .createHmac("sha256", token)
      .update(body)
      .digest("hex")}`;

    if (
      signature.length !== calculatedHash.length ||
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(calculatedHash)
      )
    )
      throw new TError("GitHub webhook signature is invalid", 401);
  }

  // Validate the request
  validateRequest(event: APIGatewayEvent) {
    const headers = event.headers;
    const sig = getProperty(headers, "x-hub-signature-256");
    const id = getProperty(headers, "x-github-delivery");

    if (!token) throw new TError("Webhook secret is not set");
    if (!config) throw new TError("Config is not set");
    if (!sig) throw new TError("Webhook signature not found on request", 400);
    if (!id) throw new TError("Webhook id not found on request", 400);

    this.validateSignature(sig, event.body);
  }

  // Find the target
  findTarget(targetId: string): WebHookServiceItem {
    const target = config[targetId];
    if (!target)
      throw new TError(
        "The target passed is not configured in forwarder service",
        400
      );
    return target;
  }
}
