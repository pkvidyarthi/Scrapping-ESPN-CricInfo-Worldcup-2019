


let minimist = require('minimist');
let fs = require('fs');
let axios = require('axios');
let jsdom = require('jsdom');
let excel = require('excel4node');
let pdf = require('pdf-lib');
let path = require('path');
const { reduceRotation } = require('pdf-lib');

let args = minimist(process.argv);


let responsePromise = axios.get(args.source);
responsePromise.then(function (response) {
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let matches = [];
    let matchScoreDivs = document.querySelectorAll("div.match-score-block ");
    for (let i = 0; i < matchScoreDivs.length; i++) {
        let match = {

        };
        let nameps = matchScoreDivs[i].querySelectorAll("p.name");
        //* Team1 and Team2
        match.t1 = (nameps[0].textContent);
        match.t2 = (nameps[1].textContent);
        //*team1 and Team2 Score
        let scoreSpan = matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");

        if (scoreSpan.length == 2) {
            match.t1score = scoreSpan[0].textContent;
            match.t2score = scoreSpan[1].textContent;
        } else if (scoreSpan.length == 1) {
            match.t1score = match.t1score = scoreSpan[0].textContent;
            match.t2score = "";

        } else {
            match.t1score = "";
            match.t2score = "";
        }

        //* Result
        // querySelector() returns a single object element, but querySelectorAll() returns an array 
        let resultSpan = matchScoreDivs[i].querySelector("div.status-text > span");
        match.result = resultSpan.textContent;

        matches.push(match);
    }
    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesJSON, "utf8");

    let teams = [];
    for (let i = 0; i < matches.length; i++) {
        putTeamInTeamsarrayIfMissing(teams, matches[i]);
    }
    for (let i = 0; i < matches.length; i++) {
        putMatchInAppropriateTeam(teams, matches[i]);
    }

    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsJSON, "utf8");
    
    createExcelFile(teams, args.excel);
    createFolders(teams, args.dataFolder);

})
.catch(function(err){
    console.log("ERROR : ",err.message,` 
NOTE : Please Check Error in Inputs.`);

})


function createFolders(teams, dataFolder){
    if(fs.existsSync(dataFolder) == true){
        fs.rmdirSync(dataFolder, { recursive: true });
    }
    fs.mkdirSync(dataFolder);


    for(let i = 0; i <teams.length; i++){
        let teamFolderName = path.join(dataFolder, teams[i].name);
        fs.mkdirSync(teamFolderName);

        for(let j = 0; j < teams[i].matches.length; j++){
            let match = teams[i].matches[j];
            createScoreCard(teamFolderName, teams[i].name, match);
        }
    }
}
 
function createScoreCard(teamFolderName, teamName, match) {
    let matchFileName = path.join(teamFolderName, match.vs);
    let t1 = teamName;
    let t2 = match.vs;
    let t1s = match.selfScore;
    let t2s = match.oppScore;
    let result = match.result;

    let bytesOfPDFTemplate = fs.readFileSync("WC2019.pdf");
    let pdfdocKaPromise = pdf.PDFDocument.load(bytesOfPDFTemplate);
    pdfdocKaPromise.then(function(pdfdoc){
        let page = pdfdoc.getPage(0);

        page.drawText(t1, {

            x: 305,
            y: 655,
            size: 14
        });
        page.drawText(t2, {
            x: 305,
            y: 630,
            size: 14
        });
        page.drawText(t1s, {
            
            x: 305,
            y: 606,
            size: 14
        });
        page.drawText(t2s, {
            
            x: 305,
            y: 582,
            size: 14
        });
        page.drawText(result, {
            
            x: 305,
            y: 560,
            size: 12
        });

        let finalPDFBytesKaPromise = pdfdoc.save();
        finalPDFBytesKaPromise.then(function(finalPDFBytes){
           if(fs.existsSync(matchFileName + ".pdf") == true){
               fs.writeFileSync(matchFileName + "1.pdf", finalPDFBytes);
           }
           else{
               fs.writeFileSync(matchFileName + ".pdf", finalPDFBytes);
           }
        })
    })
}

function createExcelFile(teams){
    let wb = new excel.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1, 1).string("Opponent");
        sheet.cell(1, 2).string("Self Score");
        sheet.cell(1, 3).string("Opp Score");
        sheet.cell(1, 4).string("Result");
        for (let j = 0; j < teams[i].matches.length; j++) {
            sheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            sheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
            sheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write(args.excel);
}

function putMatchInAppropriateTeam(teams, match) {
        let t1indx = -1;
        for (let i = 0; i < teams.length; i++) {
            if (teams[i].name == match.t1) {
                t1indx = i;
                break;
            }
        }

        let team1 = teams[t1indx];
        team1.matches.push({
            vs: match.t2,
            selfScore: match.t1score,
            oppScore: match.t2score,
            result: match.result
        });

        let t2indx = -1;
        for (let i = 0; i < teams.length; i++) {
            if (teams[i].name == match.t2) {
                t2indx = i;
                break;
            }
        }

        let team2 = teams[t2indx];
        team2.matches.push({
            vs: match.t1,
            selfScore: match.t2score,
            oppScore: match.t1score,
            result: match.result
        });
    }

function putTeamInTeamsarrayIfMissing(teams, match) {
    let t1indx = -1;for(let i = 0; i < teams.length; i++){
        if(teams[i].name == match.t1){
            t1indx = i;
            break;
        }
    }
    if(t1indx == -1){
        teams.push({
            name: match.t1,
            matches: []
        });
    }
    let t2indx = -1;for(let i = 0; i < teams.length; i++){
        if(teams[i].name == match.t2){
            t2indx = i;
            break;
        }
    }
    if(t2indx == -1){
        teams.push({
            name: match.t2,
            matches: []
        });
    }
}


    // node CricinfoExtracter.js --excel=Worldcup.csv --dataFolder=Worldcup --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results            