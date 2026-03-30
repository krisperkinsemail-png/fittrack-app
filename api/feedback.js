export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const feedbackToEmail = process.env.FEEDBACK_TO_EMAIL;
  const feedbackFromEmail =
    process.env.FEEDBACK_FROM_EMAIL || "AI Fit Feedback <onboarding@resend.dev>";

  if (!resendApiKey || !feedbackToEmail) {
    return res.status(500).json({ error: "Feedback email is not configured." });
  }

  const {
    type = "feedback",
    message = "",
    contactEmail = "",
    userEmail = "",
    activeTab = "",
    selectedDate = "",
    pageUrl = "",
    userAgent = "",
  } = req.body || {};

  if (!String(message).trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  const submittedAt = new Date().toISOString();
  const normalizedType = String(type || "feedback").trim();
  const normalizedMessage = String(message || "").trim();
  const normalizedContactEmail = String(contactEmail || "").trim();
  const normalizedUserEmail = String(userEmail || "").trim();

  const replyTo = normalizedContactEmail || normalizedUserEmail || undefined;
  const subject = `[AI Fit] ${normalizedType} report`;
  const text = [
    `Type: ${normalizedType}`,
    `Submitted: ${submittedAt}`,
    `Signed-in user: ${normalizedUserEmail || "--"}`,
    `Contact email: ${normalizedContactEmail || "--"}`,
    `Tab: ${activeTab || "--"}`,
    `Selected date: ${selectedDate || "--"}`,
    `Page URL: ${pageUrl || "--"}`,
    `User agent: ${userAgent || "--"}`,
    "",
    "Message:",
    normalizedMessage,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: feedbackFromEmail,
      to: [feedbackToEmail],
      reply_to: replyTo,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    return res.status(502).json({
      error: errorPayload?.message || "Failed to send feedback email.",
    });
  }

  return res.status(200).json({ ok: true });
}
