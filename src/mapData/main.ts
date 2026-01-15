import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { kml } from "@tmcw/togeojson";
import { DOMParser } from '@xmldom/xmldom';

const execAsync = promisify(exec);

const EXAMPLE_KML_URL = 'https://ropewiki.com/images/a/a4/Chandelier_Canyon.kml';
const FOLDER = 'src/mapData'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapDataHandler = async (event: unknown, context: any) => {
    console.log('Getting kml file from url...');
    const response = await fetch(EXAMPLE_KML_URL);
    fs.writeFileSync(`${FOLDER}/example.kml`, await response.text());

    console.log('Parsing kml file to geojson...');
    const x = new DOMParser().parseFromString(fs.readFileSync(`${FOLDER}/example.kml`, "utf8"));
    const geojson = kml(x);
    fs.writeFileSync(`${FOLDER}/example.geojson`, JSON.stringify(geojson, null, 4));

    console.log('Converting geojson to mbtiles with tippecanoe...');
    await execAsync(`tippecanoe -zg -o ${FOLDER}/example.mbtiles --drop-densest-as-needed ${FOLDER}/example.geojson`);
    console.log('Successfully created example.mbtiles');

};

// Allow running as a Node.js script (not just Lambda handler)
if (require.main === module) {
    mapDataHandler({}, {}).then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}