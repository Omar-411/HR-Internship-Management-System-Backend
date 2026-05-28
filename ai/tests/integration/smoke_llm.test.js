import "dotenv/config";
import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const res = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: "say hello in one word" }],
});

console.log(res.choices[0].message.content);