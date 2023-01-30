import randomColor from "randomcolor"
import { mkdirSync, appendFileSync, readFileSync } from "fs"

type NameMap = { [id: string]: string }

const ROOT_FOLDER = "assets/Layer_1/_face"
const templateFile = readFileSync(`${ROOT_FOLDER}/default.html`, "utf8");
const amount = 10;
// const gradientColors = gradients.map((gradient => gradient.match(/(#)([a-f]|[0-9]){6}/g)))
const template = (primaryColor: string, lightColor: string) => {
    let result = templateFile;
    const oldPrimary = templateFile.match(/--PRIMARY_COLOR: (#)([a-f]|[0-9]){6}/g)![0].split(" ")[1]
    const oldLight = templateFile.match(/--PRIMARY_LIGHT_COLOR: (#)([a-f]|[0-9]){6}/g)![0].split(" ")[1]
    result = result.replace(oldPrimary, primaryColor).replace(oldLight, lightColor);
    return result;
}


for (let k = 0; k < amount; k++) {
    const newColor = randomColor();
    const newLightColor = randomColor({ hue: newColor, luminosity: "bright" })
    appendFileSync(`${ROOT_FOLDER}/style_${k}.html`, template(newColor, newLightColor))
}