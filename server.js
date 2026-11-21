
const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();

app.use(express.json({ limit: "32kb" }));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const API_KEY = process.env.API_KEY;

const DATABASE_NAME = "Gongtue";
const COLLECTION_NAME = "ChatExp";

const MAX_LEVEL = 100000;
const DAILY_EXP_CAP = 15000;

let collection;

// ===== API 인증 =====

app.use((req, res, next) => {
    if (!API_KEY || req.headers["x-api-key"] !== API_KEY) {
        return res.status(401).json({
            ok: false,
            error: "Unauthorized"
        });
    }

    next();
});

// ===== 데이터 검증 =====

function validUserId(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function validateData(body) {
    return (
        validUserId(body.userId) &&
        Number.isSafeInteger(body.level) &&
        body.level >= 1 &&
        body.level <= MAX_LEVEL &&
        Number.isSafeInteger(body.exp) &&
        body.exp >= 0 &&
        Number.isSafeInteger(body.day) &&
        body.day >= 0 &&
        Number.isSafeInteger(body.dayExp) &&
        body.dayExp >= 0 &&
        body.dayExp <= DAILY_EXP_CAP
    );
}

// ===== 데이터 로드 =====

app.post("/load", async (req, res) => {
    try {
        const userId = req.body.userId;

        if (!validUserId(userId)) {
            return res.status(400).json({
                ok: false,
                error: "Invalid userId"
            });
        }

        const result = await collection.findOne(
            { userId },
            {
                projection: {
                    _id: 0,
                    userId: 0
                }
            }
        );

        return res.json({
            ok: true,
            data: result || null
        });

    } catch (error) {
        console.error("[MongoDB LOAD]", error);

        return res.status(500).json({
            ok: false,
            error: "Database error"
        });
    }
});

// ===== 데이터 저장 =====

app.post("/save", async (req, res) => {
    try {
        const body = req.body;

        if (!validateData(body)) {
            return res.status(400).json({
                ok: false,
                error: "Invalid data"
            });
        }

        const document = {
            userId: body.userId,
            level: body.level,
            exp: body.exp,
            day: body.day,
            dayExp: body.dayExp,
            updatedAt: new Date()
        };

        await collection.updateOne(
            { userId: body.userId },
            {
                $set: document
            },
            {
                upsert: true
            }
        );

        return res.json({
            ok: true,
            message: "Saved"
        });

    } catch (error) {
        console.error("[MongoDB SAVE]", error);

        return res.status(500).json({
            ok: false,
            error: "Database error"
        });
    }
});

// ===== 서버 상태 확인 =====

app.get("/", (req, res) => {
    res.json({
        ok: true,
        service: "Gongtue ChatExp",
        database: DATABASE_NAME,
        collection: COLLECTION_NAME
    });
});

// ===== MongoDB 연결 =====

async function start() {
    if (!MONGO_URI) {
        throw new Error("MONGO_URI 환경변수가 없습니다.");
    }

    if (!API_KEY) {
        throw new Error("API_KEY 환경변수가 없습니다.");
    }

    const client = new MongoClient(MONGO_URI, {
        serverSelectionTimeoutMS: 10000
    });

    await client.connect();

    console.log("[MongoDB] Connected");

    const db = client.db(DATABASE_NAME);

    collection = db.collection(COLLECTION_NAME);

    await collection.createIndex(
        { userId: 1 },
        { unique: true }
    );

    app.listen(PORT, "0.0.0.0", () => {
        console.log("[Gongtue] Server Started");
        console.log("[Gongtue] Database: Gongtue");
        console.log("[Gongtue] Collection: ChatExp");
    });
}

start().catch(error => {
    console.error("[STARTUP ERROR]", error);
    process.exit(1);
});
