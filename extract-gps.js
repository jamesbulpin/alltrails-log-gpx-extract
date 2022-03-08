const fs = require('fs');
const path = require('path');
const glob = require("glob");
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

const USAGE = `Usage: node extract-gps.js --logdir <alltrail log directory>
    [--from <start time>]  (example: --from "2022-03-05 15:00:29")
    [--to <end time>]      (example: --to "2022-03-05 16:49:43")
`;

const HEADER = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name><![CDATA[Recovered Track]]></name>
    <desc><![CDATA[]]></desc>
    %BOUNDS%
  </metadata>
  <trk>
    <name><![CDATA[Recovered Track]]></name>
    <trkseg>
`;

const FOOTER = `    </trkseg>
  </trk>
</gpx>
`;

function processLine(line, bounds, track, window) {
    var r = line.match(/LocFix:.*(\{.*\})/);
    if (!r) {
        return;
    }
    try {
        var j = JSON.parse(r[1]);
        if (j.la && j.ln && j.t) {
            var d = new Date(j.t);
            if (d < window.from) {
                return;
            }
            if (d > window.to) {
                return;
            }
            var trkpt = {
                d,
                la: j.la,
                ln: j.ln,
                tiebreak: track.length
            };
            track.push(trkpt);
            if (bounds.minlat == undefined) {
                bounds.minlat = j.la;
            }
            else if (j.la < bounds.minlat) {
                bounds.minlat = j.la;
            }
            if (bounds.minlon == undefined) {
                bounds.minlon = j.ln;
            }
            else if (j.ln < bounds.minlon) {
                bounds.minlon = j.ln;
            }
            if (bounds.maxlat == undefined) {
                bounds.maxlat = j.la;
            }
            else if (j.la > bounds.maxlat) {
                bounds.maxlat = j.la;
            }
            if (bounds.maxlon == undefined) {
                bounds.maxlon = j.ln;
            }
            else if (j.ln > bounds.maxlon) {
                bounds.maxlon = j.ln;
            }
        }
    }
    catch (e) {
        console.error(e);
    }
}

function processFile(filename, bounds, track, window) {
    var data = fs.readFileSync(filename).toString();
    var lines = data.split("\n");
    for (var line of lines) {
        processLine(line, bounds, track, window);
    }
}

function renderTrackPoint(trkpt) {
    var ts = trkpt.d.toISOString().replace(/\.\d{3}Z/, "Z");
    var xml = '      <trkpt lat="' + trkpt.la + '" lon="' + trkpt.ln + '">\n';
    xml += '        <time>' + ts + '</time>\n';
    xml += '      </trkpt>';
    return xml;
}

function render(bounds, track) {
    track.sort((a, b) => (a.d > b.d)?1:(a.d < b.d)?-1:(a.tiebreak > b.tiebreak)?1:(a.tiebreak < b.tiebreak)?-1:0);
    var boundsXml = '<bounds ' + Object.keys(bounds).map(k => k + '="' + bounds[k] + '"').join(" ") + '/>';
    console.log(HEADER.replace("%BOUNDS%", boundsXml));
    for (var trkpt of track) {
        console.log(renderTrackPoint(trkpt));
    }
    console.log(FOOTER);
}

if (!argv.logdir) {
    console.error(USAGE);
    process.exit(1);
}

var track = [];
var bounds = {};
var window = {
    from: new Date(argv.from || "1970-01-01 00:00:00"),
    to: new Date(argv.to || "2099-12-31 23:59:59")
}

glob(path.join(argv.logdir, "*.txt"), function (err, files) {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    for (var filename of files) {
        processFile(filename, bounds, track, window);
    }
    render(bounds, track);
});
