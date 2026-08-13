import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

let client: SESv2Client | null = null;

function getClient(): SESv2Client {
  if (client) return client;

  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must all be set to send email.",
    );
  }

  client = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo: string;
}

export interface SendEmailResult {
  messageId: string;
}

function fromAddress(): string {
  const address = process.env.SES_FROM_ADDRESS;
  if (!address) {
    throw new Error("SES_FROM_ADDRESS is not set.");
  }
  return address;
}

export async function sendCampaignEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const command = new SendEmailCommand({
    FromEmailAddress: fromAddress(),
    Destination: { ToAddresses: [input.to] },
    ReplyToAddresses: [input.replyTo],
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: input.textBody, Charset: "UTF-8" },
          Html: { Data: input.htmlBody, Charset: "UTF-8" },
        },
      },
    },
  });

  const result = await getClient().send(command);
  if (!result.MessageId) {
    throw new Error("SES did not return a message id.");
  }
  return { messageId: result.MessageId };
}
