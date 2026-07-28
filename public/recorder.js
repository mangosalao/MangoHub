let mediaRecorder;
let audioChunks = [];
let audioBlob = null;

let countdownInterval;
let secondsRemaining = 30;

const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const sendBtn = document.getElementById("sendBtn");
const audioPlayer = document.getElementById("audioPlayer");
const timer = document.getElementById("timer");

recordBtn.addEventListener("click", async function () {

try {

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
    });

    audioChunks = [];
    audioBlob = null;

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = function (event) {

        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }

    };

    mediaRecorder.onstop = function () {

        audioBlob = new Blob(audioChunks, {
            type: "audio/webm"
        });

        const audioUrl =
            URL.createObjectURL(audioBlob);

        audioPlayer.src = audioUrl;

        sendBtn.disabled = false;

        clearInterval(countdownInterval);

        timer.textContent = "00:30";
        timer.style.color = "white";

        console.log("Audio listo");

    };

    mediaRecorder.start();

    recordBtn.disabled = true;
    stopBtn.disabled = false;
    sendBtn.disabled = true;

    secondsRemaining = 30;

    timer.textContent = "00:30";
    timer.style.color = "#ef4444";

    countdownInterval = setInterval(() => {

        secondsRemaining--;

        timer.textContent =
            "00:" +
            String(secondsRemaining)
                .padStart(2, "0");

        if (secondsRemaining <= 10) {

            timer.style.color = "#f59e0b";

        }

        if (secondsRemaining <= 0) {

            clearInterval(
                countdownInterval
            );

            if (
                mediaRecorder &&
                mediaRecorder.state ===
                    "recording"
            ) {

                mediaRecorder.stop();

            }

            recordBtn.disabled = false;
            stopBtn.disabled = true;

        }

    }, 1000);

} catch (error) {

    console.error(error);

    alert(
        "Error al acceder al micrófono:\n" +
        error.message
    );

}

});

stopBtn.addEventListener("click", function () {

clearInterval(countdownInterval);

if (
    mediaRecorder &&
    mediaRecorder.state === "recording"
) {

    mediaRecorder.stop();

}

recordBtn.disabled = false;
stopBtn.disabled = true;

});

sendBtn.addEventListener(
"click",
async function () {

const username =
    window.twitchUsername;


    if (!audioBlob) {

        alert(
            "Debes grabar un audio"
        );

        return;
    }

    try {

        const formData =
            new FormData();

        formData.append(
            "username",
            username
        );

        formData.append(
            "audio",
            audioBlob,
            "audio.webm"
        );

        const response =
            await fetch(
                "/upload",
                {
                    method: "POST",
                    body: formData
                }
            );

        const result =
            await response.json();

        if (result.success) {

            alert(
                "Audio enviado correctamente"
            );

            sendBtn.disabled = true;

            console.log(result);

        }

    } catch (error) {

        console.error(error);

        alert(
            "Error enviando audio"
        );

    }

}

);
