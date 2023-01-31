import randomColor from "randomcolor"
import { readdirSync, readFileSync, writeFileSync } from "fs"

const ROOT_FOLDER = "assets/Layer_1/primary_color"
const templateFile = readFileSync(`${ROOT_FOLDER}/${readdirSync(ROOT_FOLDER)[0]}`, "utf8");
const amount = 50;
// const gradientColors = gradients.map((gradient => gradient.match(/(#)([a-f]|[0-9]){6}/g)))
const template = (primaryColor: string, lightColor: string) => {
    let result = templateFile;
    const oldPrimary = templateFile.match(/--PRIMARY_COLOR: (#)([a-f]|[0-9]){6}/g)![0].split(" ")[1]
    const oldLight = templateFile.match(/--PRIMARY_LIGHT_COLOR: (#)([a-f]|[0-9]){6}/g)![0].split(" ")[1]
    result = result.replace(oldPrimary, primaryColor).replace(oldLight, lightColor);
    return result;
}


const randomColors = randomColor({ count: amount });
for (let k = 0; k < amount; k++) {
    const random = randomColors[k];
    const newLightColor = randomColor({ hue: random, luminosity: "bright" })
    const newDarkColor = randomColor({ hue: random, luminosity: "dark" })
    writeFileSync(`${ROOT_FOLDER}/${encodeURIComponent(newDarkColor)}.html`, template(newDarkColor, newLightColor))
}