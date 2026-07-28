const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const http = require("http");

const { Server } = require("socket.io");

const db = require("./database");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

const PORT = 3000;

let currentAudio = null;

app.use(express.static("public"));
app.use("/admin", express.static("admin"));
app.use("/overlay", express.static("overlay"));
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({

destination: function (req, file, cb) {

cb(null, "uploads/");

},

filename: function (req, file, cb) {

cb(
    null,
    Date.now() + ".webm"
);

}

});

const upload = multer({
storage
});

function emitQueueUpdate() {

io.emit("queue-updated");

}

app.post(
"/upload",
upload.single("audio"),
(req, res) => {

const username = req.body.username;
const filename = req.file.filename;

db.run(
    `
    INSERT INTO audios
    (username, filename)
    VALUES (?, ?)
    `,
    [username, filename],
    function (err) {

        if (err) {

            console.error(err);

            return res.status(500)
                .json({
                    success: false
                });

        }

        emitQueueUpdate();

        res.json({
            success: true,
            id: this.lastID
        });

    }
);

}
);

app.get("/queue", (req, res) => {

db.all(
`     SELECT *
    FROM audios
    WHERE status='pending'
    ORDER BY id ASC
    `,
[],
(err, rows) => {

    if (err) {

        return res.status(500)
            .json([]);

    }

    res.json(rows);

}

);

});

app.get("/admin/queue", (req, res) => {

db.all(
`     SELECT *
    FROM audios
    ORDER BY id DESC
    `,
[],
(err, rows) => {

    if (err) {

        return res.status(500)
            .json([]);

    }

    res.json(rows);

}

);

});

app.get("/next-audio", (req, res) => {

db.get(
`     SELECT *
    FROM audios
    WHERE status='pending'
    ORDER BY id ASC
    LIMIT 1
    `,
[],
(err, row) => {

    if (err) {

        return res.status(500)
            .json({
                success: false
            });

    }

    res.json(row || null);

}

);

});

app.get("/current-audio", (req, res) => {

res.json(
currentAudio || null
);

});

app.post("/mark-played/:id", (req, res) => {

db.run(
`     UPDATE audios
    SET status='played'
    WHERE id=?
    `,
[req.params.id],
function (err) {

    if (err) {

        return res.status(500)
            .json({
                success: false
            });

    }

    emitQueueUpdate();

    res.json({
        success: true
    });

}

);

});

app.delete(
"/delete-audio/:id",
(req, res) => {

db.get(
    `
    SELECT *
    FROM audios
    WHERE id=?
    `,
    [req.params.id],
    (err, row) => {

        if (err || !row) {

            return res.status(404)
                .json({
                    success: false
                });

        }

        const filePath =
            path.join(
                __dirname,
                "uploads",
                row.filename
            );

        if (
            fs.existsSync(filePath)
        ) {

            fs.unlinkSync(
                filePath
            );

        }

        db.run(
            `
            DELETE FROM audios
            WHERE id=?
            `,
            [req.params.id],
            () => {

                emitQueueUpdate();

                res.json({
                    success: true
                });

            }
        );

    }
);

}
);

io.on("connection", (socket) => {

console.log(
    "Cliente conectado:",
    socket.id
);

socket.on(
    "audio-started",
    (audio) => {

        currentAudio = audio;

        io.emit(
            "current-audio",
            currentAudio
        );

    }
);

socket.on(
    "audio-ended",
    () => {

        currentAudio = null;

        io.emit(
            "current-audio",
            null
        );

    }
);

socket.on(
    "skip-audio",
    () => {

        io.emit(
            "force-stop"
        );

    }
);

});

app.get("/", (req, res) => {

res.sendFile(
path.join(
__dirname,
"public",
"index.html"
)
);

});

server.listen(PORT, () => {

console.log(
`Servidor iniciado en http://localhost:${PORT}`
);

});
