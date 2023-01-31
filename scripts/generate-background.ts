import randomColor from "randomcolor"
import { writeFileSync, readFileSync } from "fs"

const ROOT_FOLDER = "assets/Layer_1/background_color"
const amount = 50;
const template = readFileSync(`${ROOT_FOLDER}/default.html`, "utf8")
const randomColors = randomColor({ count: amount, luminosity: "dark" });

for (let k = 0; k < amount; k++) {
    const newColor = randomColors[k];
    let result = template;
    const oldColor = template.match(/(#)([a-f]|[0-9]){6}/g)![0]
    result = result.replace(oldColor, newColor)
    writeFileSync(`${ROOT_FOLDER}/${newColor}.html`, result)
}