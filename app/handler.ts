import { WebHookService } from "./service/webhook-service";
import { handleError } from "./utils/helper";

export const webhook = async (event, context) => {
  try {
    const webhookService = new WebHookService();
    const result = await webhookService.handleSync(event, context);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: result }),
    };
  } catch (error) {
    return handleError(error);
  }
};

export const webhookAsync = async (event, context) => {
  try {
    const webhookService = new WebHookService();
    const result = await webhookService.handleAsync(event, context);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: result }),
    };
  } catch (error) {
    return handleError(error);
  }
};

export const worker = async (event, context) => {
  try {
    const webhookService = new WebHookService();
    const result = await webhookService.processTarget(event, context);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: result }),
    };
  } catch (error) {
    return handleError(error);
  }
};
