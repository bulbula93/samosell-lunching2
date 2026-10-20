// Split top-level SQL without mistaking comments, strings or function bodies for DDL.
export function sqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = "", quote = "", dollar = "", blockDepth = 0, lineComment = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i], next = sql[i + 1]
    if (lineComment) {
      if (ch === "\n") { lineComment = false; current += " " }
      continue
    }
    if (blockDepth) {
      if (ch === "/" && next === "*") { blockDepth++; i++ }
      else if (ch === "*" && next === "/") { blockDepth--; i++; current += " " }
      continue
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { current += dollar; i += dollar.length - 1; dollar = "" }
      else current += ch
      continue
    }
    if (quote) {
      current += ch
      if (ch === quote) {
        if (next === quote) { current += next; i++ }
        else quote = ""
      }
      continue
    }
    if (ch === "-" && next === "-") { lineComment = true; i++; continue }
    if (ch === "/" && next === "*") { blockDepth = 1; i++; current += " "; continue }
    if (ch === "'" || ch === '"') { quote = ch; current += ch; continue }
    const tag = ch === "$" ? sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0] : undefined
    if (tag) { dollar = tag; current += tag; i += tag.length - 1; continue }
    current += ch
    if (ch === ";") { if (current.trim()) statements.push(current.trim()); current = "" }
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}
