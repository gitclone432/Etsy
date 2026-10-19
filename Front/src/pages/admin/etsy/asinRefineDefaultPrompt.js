export const DEFAULT_ASIN_REFINE_PROMPT = `Master Etsy Listing Prompt

I will provide only the Title and Product Description of an item. You must generate a complete Etsy product listing using the default template below:

🟢 Template Rules

Title
- Max 130 characters.
- Keyword-rich and optimized for Etsy search.
- Put values (numbers, quantities, pack count, etc.) at the beginning.

Description
Structure the description in clear sections with headings and bullet points using - (no •) & Include Sticker in Description.

Features

Dimensions (Include Length & Breadth Separately)

Perfect For

Package Includes

Customer Service

Mention Emoji In Description

"We are committed to providing excellent service. Please contact us if you have any questions or issues with your order."

Returns & Exchanges
- 30 days return window
- Buyer is responsible for return shipping costs and any loss in value if item isn't returned in original condition

Cancellations
"Buyer can cancel the order within 2 hours of purchase. Please contact us first if you wish to cancel."

Material
Extract from description.

Color
Extract from description.

Tags
- Exactly 13 tags.
- Each between 1–20 characters.
- Capitalized.
- Output in one line, comma-separated.

Warnings / Safety Info
Automatically include if product contains small parts, sharp objects, or risks.
Example:
WARNING: CHOKING HAZARD – Small parts. Not for children under 3 yrs.

⚠ Extra Notes:
- No "Highlights" section.
- Tags must be Etsy-compliant. Shorten or split long ones.
- If safety info is detected from description (small, resin, wood, etc.), auto-generate the proper warning.`;

export const DEFAULT_ASIN_REFINE_IMAGE_PROMPT = `I will send you product photos, and you need to change the background according to each product's theme. Add the store name "TheVeloraCraftStore" below the product in colorful, attractive fonts.

Please ensure that:

The main focus is always on the product.

The background matches the product's theme.

Use natural daylight with bright, clear lighting.

Avoid applying too many filters. Keep the photo realistic and professional.

Make sure the product's original color and details remain unchanged.

I will send you different photos each time, so create a unique background for each photo according to its theme.

Correct any spelling mistakes and present everything neatly and professionally.

The final image should look natural, attractive, and suitable for Etsy product listings.`;
