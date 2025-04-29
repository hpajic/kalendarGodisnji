export default async function handler(req, res) {
  const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwF4HrO5Z9EM5x9WeigxqnbduG09pfWD0EBjyuXXXdsUBP2eRWnNkwQfwuvmiaZJP6h/exec";

  if (req.method === "POST") {
    const response = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(data);
    return;
  }
  if (req.method === "GET") {
    const response = await fetch(SHEET_API_URL);
    const data = await response.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(data);
    return;
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).end();
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(405).send("Method Not Allowed");
}