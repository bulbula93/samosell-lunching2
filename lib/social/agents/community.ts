/**
 * Community agent — classifies comments/DMs and drafts replies. Never sends anything in v1:
 * the Policy Gateway denies `send_community_reply`. Complaints always escalate to a human.
 */
export type CommentIntent = "price_question" | "availability_question" | "how_to_buy" | "complaint" | "spam" | "praise" | "other"
export type CommunityDraft = { intent: CommentIntent; escalate: boolean; reply: string | null }

const RULES: ReadonlyArray<[CommentIntent, RegExp]> = [
  ["spam", /(https?:\/\/(?!(www\.)?samosell\.ge)|crypto|bitcoin|whatsapp\s*\+|გამოიმუშავე|ფოლოვერ)/iu],
  ["complaint", /(თაღლით|მოტყუ|ცუდი|ვერ მივიღე|არ მოვიდა|scam|fraud|refund|დამიბრუნ)/iu],
  ["price_question", /(ფასი|რა ღირს|რამდენი|price|\bcost\b|₾|ლარი)/iu],
  ["availability_question", /(ჯერ კიდევ|ხელმისაწვდომ|ისევ გაქვთ|available|ზომა|size)/iu],
  ["how_to_buy", /(როგორ ვიყიდო|როგორ შევიძინო|მიტანა|delivery|how to buy|გაგზავნ)/iu],
  ["praise", /(მაგარია|ლამაზი|სუპერ|❤️|😍|love|great)/iu],
]

export function classifyComment(text: string): CommentIntent {
  const value = text.slice(0, 1000)
  for (const [intent, rule] of RULES) if (rule.test(value)) return intent
  return "other"
}

export function draftCommunityReply(text: string): CommunityDraft {
  const intent = classifyComment(text)
  switch (intent) {
    case "spam": return { intent, escalate: false, reply: null }
    case "complaint": return { intent, escalate: true, reply: null }
    case "price_question": return { intent, escalate: false, reply: "გამარჯობა! ფასი და დეტალები განცხადების გვერდზეა — ბმული პროფილშია. გამყიდველს პირდაპირ SamoSell-ის ჩატში შეგიძლიათ მისწეროთ 🙌" }
    case "availability_question": return { intent, escalate: false, reply: "გამარჯობა! ხელმისაწვდომობა და ზომა გამყიდველთან დააზუსტეთ SamoSell-ის ჩატში — ბმული პროფილშია 💬" }
    case "how_to_buy": return { intent, escalate: false, reply: "SamoSell-ზე გამყიდველს პირდაპირ წერთ და მიტანასაც მასთან ერთად თანხმდებით. საკომისიოს არ ვიღებთ ✅" }
    case "praise": return { intent, escalate: false, reply: "მადლობა! ❤️" }
    default: return { intent, escalate: true, reply: null }
  }
}
