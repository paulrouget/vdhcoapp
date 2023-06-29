const rpc = require('./weh-rpc');
const logger = require('./logger');

const { spawn } = require('child_process');
const { ffmpeg, ffprobe } = require('./binaries');

// `-progress pipe:1` send program-friendly progress information to stdin every 500ms.
// `-hide_banner -loglevel error`: make the output less noisy.
const ffmpeg_base_args = "-progress pipe:1 -hide_banner -loglevel error";

// Dump data in json format
const ffprobe_base_args = "-v quiet -print_format json";

rpc.listen({
  "resolve": (input) => new Promise((resolve, reject) => {
    let args = ffprobe_base_args + " -show_format -show_streams";
    args = args.split(" ");
    args.push(input);
    const child = spawn(ffprobe, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => stdout += data);
    child.stderr.on("data", (data) => stderr += data);
    child.on("exit", (code) => {
      if (code == 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch (_) {
          reject(new Error("ffprobe output is not JSON"));
        }
      } else {
        reject(new Error("ffprobe returned exit code " + code));
      }
    });
  }),
  "consolidate": (input, a, v, timer_id, output) => new Promise((resolve, reject) => {
    let args = `-y -i ${input} ${ffmpeg_base_args} -map 0:${v} -map 0:${a} ${output}`;
    args = args.split(" ");
    const child = spawn(ffmpeg, args);
    let stderr = "";
    child.stderr.on("data", (data) => stderr += data);
    child.stdout.on("data", (lines) => {
      lines = lines.toString("utf-8").split("\n");
      lines.forEach((line) => {
        if (line.startsWith("out_time_ms=")) {
          const ms = line.split("=")[1];
          rpc.call("consolidate_tick", timer_id, ms);
        }
      });
    });
    child.on("exit", (code) => {
      if (code == 0) {
        resolve();
      } else {
        reject(new Error("ffmpeg returned exit code " + code + ". With stderr: " + stderr));
      }
    });
  }),
});
