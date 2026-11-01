const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeFinance(snapshot) {
  const { kpis, trend, recommendations } = snapshot;

  const trendSummary = trend
    .map((m) => `${m.month}: income ₹${m.income}, expenses ₹${m.expenses}`)
    .join(" | ");

  const prompt = `You are a school finance analyst. Analyze the following school finance department data and provide a concise, actionable analysis.

## Finance Snapshot
- Total Invoiced: ₹${kpis.invoiced}
- Total Collected: ₹${kpis.collected}
- Outstanding Fees: ₹${kpis.outstanding}
- Total Expenses: ₹${kpis.expenses}
- Net Cash Position: ₹${kpis.netCash}
- Overdue Invoices: ${kpis.overdueCount}
- Pending Invoices: ${kpis.outstandingCount}

## 6-Month Trend
${trendSummary}

## System Recommendations
${recommendations.map((r) => `[${r.type.toUpperCase()}] ${r.title}: ${r.detail}`).join("\n")}

Provide your analysis in the following structure:
1. **Overall Financial Health** – A 2-3 sentence summary of the school's current financial position.
2. **Key Risks** – Bullet points of the top risks identified.
3. **Cash Flow Insights** – Observations from the 6-month trend.
4. **Actionable Recommendations** – Specific steps the finance department should take immediately.
5. **Outlook** – Short-term financial outlook (next 1-2 months).

Be direct, data-driven, and specific to a school finance context.`;

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama3-8b-8192",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 1024,
  });

  return completion.choices[0]?.message?.content || "Analysis unavailable.";
}

module.exports = { analyzeFinance };
