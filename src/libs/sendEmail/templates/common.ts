const LOGO_URL = 'https://www.lmmarket.com/logo.png';

export const header = () => `
  <table
    style="
      width: 100%;
      border-bottom: 1px solid #dbdbdb;
      margin-bottom: 24px;
      padding-bottom: 16px;
    "
  >
    <tr>
      <td style="vertical-align: top; width: 70px; min-width: 70px">
        <img
          alt="LM Market"
          style="min-width: 70px; max-width: 70px; min-height: 70px; max-height: 70px; margin-right: 8px;"
          src="${LOGO_URL}"
        />
      </td>
      <td>
        <p style="font-size: 24px; text-align: start; font-weight: bold; margin: 0;">
          LM Market
        </p>
      </td>
    </tr>
  </table>
`;

export const footer = () => `
  <p style="color: #989B9B; margin-top: 28px; text-align: center;">
    © LM Market
  </p>
`;
