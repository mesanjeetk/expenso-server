import { resend } from "./resend.js";
import { houseHoldInvitesTemplate, welcomeTemplate } from "./templates.js";

const sendWelcomeEmail = async ({ to, name, verifyLink }) => {
  
  let html = welcomeTemplate
    .replace("{{name}}", name)
    .replace("{{verifyLink}}", verifyLink);

  await resend.emails.send({
    from: "Expenzo <onboarding@resend.dev>",
    to,
    subject: "Welcome to Expenzo",
    html
  });
};


const sendHouseHoldInvitesEmail = async ({inviterName, inviteAcceptLink, to}) => {
  let html = houseHoldInvitesTemplate
    .replace("{{inviterName}}", inviterName)
    .replace("{{inviteAcceptLink}}", inviteAcceptLink);

  await resend.emails.send({
    from: "Expenzo <onboarding@resend.dev>",
    to,
    subject: "Invitation from " + inviterName,
    html
  })
}

export { sendWelcomeEmail, sendHouseHoldInvitesEmail };
