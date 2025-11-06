export const welcomeTemplates = `
<html>
  <body style="margin:0; padding:0; background:#0f172a; font-family:Arial, Helvetica, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#0f172a" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="#1e293b" style="border-radius:12px; background:#1e293b;">
            
            <!-- HEADER -->
            <tr>
              <td style="padding:24px 32px;">
                <table width="100%">
                  <tr>
                    <td align="left">
                      <div style="font-size:22px; font-weight:700; color:#22d3ee;">Expenzo</div>
                      <div style="font-size:13px; font-weight:600; color:#94a3b8; margin-top:6px;">Smarter expenses. Happier life.</div>
                    </td>
                    <td align="right">
                      <div style="width:44px; height:44px; background:#134e4a; border-radius:10px; font-weight:700; color:#22d3ee; display:flex; align-items:center; justify-content:center;">E</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:24px 32px;">
                <div style="font-size:20px; font-weight:700; color:#e2e8f0; margin-bottom:10px;">Welcome to Expenzo, {{name}} 👋</div>

                <div style="font-size:15px; color:#CBD5E1; margin-bottom:16px;">
                  Thanks for joining Expenzo! You're all set to track spending & manage budgets in a smarter way.
                </div>

                <div style="font-size:15px; color:#CBD5E1; margin-bottom:20px;">
                  Before you begin, please verify your email address:
                </div>

                <!-- BUTTON -->
                <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto;">
                  <tr>
                    <td align="center" bgcolor="#22d3ee" style="border-radius:8px;">
                      <a href="{{verifyLink}}" target="_blank" style="display:inline-block; padding:12px 22px; font-size:15px; font-weight:600; color:#0f172a; text-decoration:none;">
                        Verify Email
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-size:13px; color:#94a3b8; margin-top:12px;">If the button doesn't work, copy this link:</div>

                <div style="font-size:13px; color:#22d3ee; word-break:break-all; margin-top:6px;">
                  <a href="{{verifyLink}}" style="color:#22d3ee; text-decoration:none;">{{verifyLink}}</a>
                </div>

                <hr style="border:none; border-top:1px solid #334155; margin:24px 0;" />

                <div style="font-size:15px; font-weight:600; color:#e2e8f0; margin-bottom:6px;">Need help?</div>
                <div style="font-size:13px; color:#94a3b8;">Reply to this email or contact <a href="mailto:support@expenzo.com" style="color:#22d3ee; text-decoration:none;">support@expenzo.com</a></div>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td align="center" style="padding:18px 32px; font-size:13px; color:#64748b; background:#1e293b;">
                © 2025 Expenzo — Simplifying expenses.<br/>
                If you didn’t create an Expenzo account, ignore this email.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const houseHoldInvitesTemplate = `
<html>
  <body style="margin:0; padding:0; background:#0d1526; font-family:Arial, Helvetica, sans-serif;">
    <table width="100%" cellspacing="0" cellpadding="0" bgcolor="#0d1526" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table width="600" cellspacing="0" cellpadding="0" bgcolor="#162132" style="border-radius:16px; overflow:hidden;">

            <!-- Header / branding -->
            <tr>
              <td style="background:linear-gradient(135deg,#22d3ee,#38bdf8); padding:28px 32px;" align="center">
                <img src="https://cdn-icons-png.flaticon.com/512/4341/4341139.png" width="64" height="64" style="display:block;margin-bottom:12px;" alt="">
                <div style="color:#0f172a; font-size:24px; font-weight:800; letter-spacing:-0.5px;">
                  Expenzo
                </div>
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td style="padding:28px 32px; color:#f1f5f9; font-size:22px; font-weight:700; border-bottom:1px solid #223047;">
                You've Been Invited!
              </td>
            </tr>

            <!-- Message -->
            <tr>
              <td style="padding:24px 32px; color:#cbd5e1; font-size:15px; line-height:1.6;">
                <strong>{{inviterName}}</strong> has invited you to join their <strong>Expenzo</strong> household.<br><br>
                This allows you to track shared expenses, manage spending, see transactions together — everything in one place.
              </td>
            </tr>

            <!-- CTA Button -->
            <tr>
              <td align="center" style="padding:20px 0 28px;">
                <a href="{{inviteAcceptLink}}" style="display:inline-block; padding:14px 32px; background:#22d3ee; color:#0f172a; font-weight:700; border-radius:8px; text-decoration:none; font-size:15px;">
                  Accept Invitation
                </a>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:28px 32px; color:#7989a5; font-size:12px; line-height:1.5; border-top:1px solid #223047;">
                If you don’t recognize {{inviterName}} or didn’t expect this invite, you can safely ignore this email.
                <br><br>
                © 2025 Expenzo — Smarter Expense Tracking
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`