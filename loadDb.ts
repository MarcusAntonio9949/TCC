import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer"
import { GoogleGenAI } from "@google/genai"


import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"

import "dotenv/config"


type SimilarityMetric = "dot_product" | "cosine" | "euclidean"

const { ASTRA_DB_NAMESPASCE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_API_APPLICATION_TOKEN,
    GEMINI_API_KEY} = process.env

const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY})

const ifbotData = [
    'https://terraria.wiki.gg/',
    'https://terraria.wiki.gg/wiki/King_Slime',
    'https://terraria.wiki.gg/wiki/Eye_of_Cthulhu',
    'https://terraria.wiki.gg/wiki/Wall_of_Flesh',
    'https://terraria.wiki.gg/wiki/Bosses#Hardmode_bosses',
    'https://terraria.wiki.gg/wiki/Weapons'
]

const client = new DataAPIClient(ASTRA_DB_API_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, {namespace: ASTRA_DB_NAMESPASCE})

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product")=> {
    const res = await db.createCollection(ASTRA_DB_COLLECTION,{
        vector:{
            dimension: 153,
            metric: similarityMetric,
        }
    })
    console.log(res)
}

const loadSampleData = async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION)


    for await (const url of ifbotData){
        const content = await ScrapePage(url)
        const chunks = await splitter.splitText(content)
            for await (const chunk of chunks){
                const embedding = await genai.models.embedContent({
                    model: 'text-multilingual-embedding-001',
                    contents: chunk,

                });
                const vector = embedding.metadata[0].values;

                const res = await collection.insertOne({
                    $vector: vector,
                    text: chunk
                })
                console.log(res)
            }
    }
}
const ScrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true,
        },
        gotoOptions: {
            waitUntil: "documentloaded",
        },
        evaulute: async (page, browser) => {
           const result = await page.evaulute(() => document.body.innerHTML)
            await browser.close()
            return result
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>/gm, '')
}

createCollection().then(() => loadSampleData())