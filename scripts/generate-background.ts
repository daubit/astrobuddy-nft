import randomColor from "randomcolor"
import { writeFileSync, readFileSync } from "fs"

const ROOT_FOLDER = "assets/Layer_1/_background"
const amount = 10;
const template = readFileSync(`${ROOT_FOLDER}/default.html`, "utf8")

for (let k = 0; k < amount; k++) {
    let result = template;
    const oldColor = template.match(/(#)([a-f]|[0-9]){6}/g)![0]
    const newColor = randomColor();
    result = result.replace(oldColor, newColor)
    writeFileSync(`${ROOT_FOLDER}/style_${k}.html`, result)
}