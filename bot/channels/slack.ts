import { defaultSlackAuth, slackChannel, type SlackMessageHandler } from "@cursor/bdk/channels/slack";

const onVendorMessage: SlackMessageHandler = (ctx, message) => {
  const auth = defaultSlackAuth(message, ctx);
  if (auth === null) return null;
  const sender = message.author?.userName;
  const hint =
    sender === undefined
      ? "The Slack message may not name a requester. Ask if requester name is missing."
      : `Slack sender @${sender} may be the requester when the message does not name someone else.`;
  return {
    auth,
    title: "Vendor onboarding",
    context: [
      "This is Acme vendor onboarding.",
      hint,
      "Call record_vendor_request for a new request. If this thread already has a request id, call update_vendor_request on that same id.",
      "If required fields are missing, call draft_collection_followup and stop. Do not call research_vendor.",
    ],
  };
};

export default slackChannel({
  envPrefix: "VENDOR_ONBOARDING",
  onAppMention: onVendorMessage,
  onDirectMessage: onVendorMessage,
  suggestedPromptsTitle: "Vendor onboarding",
  suggestedPrompts: [
    {
      title: "New vendor",
      message: "New vendor request. I will give you the requester, vendor, category, and urgency.",
    },
    {
      title: "What is missing?",
      message: "What fields are still missing before research can start?",
    },
    {
      title: "Weekly summary",
      message: "Produce this week's leadership summary of approved vendors.",
    },
  ],
});
