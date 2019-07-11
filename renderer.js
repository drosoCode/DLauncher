
const { shell,dialog } = require('electron').remote;
const { ipcRenderer } = window.require('electron');

const node_fs = require('fs');
const node_os = require("os");
const node_path = require('path');
var node_exec = require('child_process').execFile;

var hostname = node_os.hostname();
var systemConfigPath = node_path.join(__dirname, 'config.json');
var systemConfig = JSON.parse(node_fs.readFileSync(systemConfigPath));
var exchangeFolderPath = null;
var data = null;

function sleep(milliseconds) {
    var dt = new Date();
    while ((new Date()) - dt <= milliseconds) { /* Do nothing */ }
}

if(systemConfig["syncPath"] == null || !node_fs.existsSync(node_path.join(systemConfig["syncPath"],"data.json")))
{
    showSystemModal();
}
else
{
    exchangeFolderPath = systemConfig["syncPath"];
    document.getElementById("navAddGame").style = "";
    document.getElementById("navForceSync").style = "";
    data = JSON.parse(node_fs.readFileSync(node_path.join(exchangeFolderPath,"data.json")));
}


window.addEventListener('DOMContentLoaded', () => {
  for (const versionType of ['chrome', 'electron', 'node']) {
    document.getElementById(`${versionType}-version`).innerText = process.versions[versionType]
  }
  document.getElementById("hostname").innerText = hostname;

  if(data != null)
  {
    generateGameCards();
    ipcRenderer.send('background-sync', {"type":"sync","data":"all"})
  }

})


// Async message handler
ipcRenderer.on('renderer', (event, arg) => {
    console.log(arg);
    if(arg["type"] == "guiInfo")
    {
        let infoTxt = document.getElementById("statusText");
        infoTxt.innerText = arg["data"];
        infoTxt.className = "navbar-text text-"+arg["color"];
    }
    else if(arg["type"] == "gameStatus")
    {
        var footer = document.getElementById("card"+arg["data"]+"_footer");
        if(arg["status"] == "running")
        {
            if(footer.classList.contains("bg-success"))
              footer.classList.remove("bg-success");

            if(!footer.classList.contains("bg-primary"))
              footer.classList.add("bg-primary");
        }
        else
        {
            if(footer.classList.contains("bg-primary"))
              footer.classList.remove("bg-primary");
        }
    }
    else if(arg["type"] == "gameSyncStatus")
    {
        var footer = document.getElementById("card"+arg["data"]+"_statusBar");
        removeBackgroundColorClasses(footer);
        if(arg["status"] == "ok")
        {
            footer.classList.add("bg-success");
        }
        else if(arg["status"] == "waiting")
        {
            footer.classList.add("bg-warning");
        }
        else if(arg["status"] == "failed")
        {
            footer.classList.add("bg-danger");
        }
        else if(arg["status"] == "unavailable")
        {
            document.getElementById("card"+arg["data"]+"_playBtn").style = "display:none;"
            footer.classList.add("bg-dark");
        }
        else if(arg["status"] == "disabled")
        {
            footer.classList.add("bg-secondary");
        }
    }
    else if(arg["type"] == "updateGameTxt")
    {
        let text = "This Week: "+arg["play7"].toString()+" H<br>Total: "+arg["playTotal"].toString()+" H"+"<br>Last Use: "+arg["lastDate"];
        document.getElementById("card0_gameTitle").setAttribute("data-original-title",text);
    }
})

function removeBackgroundColorClasses(element)
{
    let list = element.classList;
    let colors = ["primary","success","danger","warning","secondary","info","light"];
    colors.forEach(function(item){
        if(list.contains("bg-"+item))
            element.classList.remove("bg-"+item);
    });
}

       
function quitApp()
{
    ipcRenderer.send('main', {"type":"quit","data":"all"})
}

function forceFilesSync()
{
    ipcRenderer.send('background-sync', {"type":"forceSync","data":"all"})
}

function generateGameCards()
{
  var doc = document.getElementById("gameCards");
  let i = 0;
  data["games"].forEach(function(item) 
  {
      txt = "This Week: "+item["play7"].toString()+" H<br>Total: "+item["playTotal"].toString()+" H"+"<br>Last Use: "+item["lastDate"];
      doc.innerHTML += makeCard(i,item["name"],item["img"],txt);
      i++;
  });
}

function showSystemModal()
{
    if(exchangeFolderPath == null)
    {
        document.getElementById("input_systemSave").value = "";
    }
    else
    {
        document.getElementById("input_systemSave").value = systemConfig["syncPath"];
        document.getElementById("systemOpenSyncFolder").style = "";
    }
    document.getElementById("input_systemStart").checked = systemConfig["autoStart"];
    document.getElementById("input_systemDebug").checked = systemConfig["debug"];
    document.getElementById("input_scanInterval").value = systemConfig["scanInterval"];

    $('#modalSystemSettings').modal('show');
}

function saveSystemSettings()
{
    let syncPath = document.getElementById("input_systemSave").value
    if(node_fs.existsSync(syncPath))
    {
        if(!node_fs.existsSync(node_path.join(syncPath,"data.json")))
        {
            node_fs.writeFile(node_path.join(syncPath,"data.json"), JSON.stringify({"lastWeekReset":0,"games":[]}), (err) => {
                if (err) {
                    if(debug)
                        console.log(err);
                    return;
                }});
        }      
        if(!node_fs.existsSync(node_path.join(syncPath,"saves")))
        {
            node_fs.mkdirSync(node_path.join(syncPath,"saves"));
        }
        if(!node_fs.existsSync(node_path.join(syncPath,"cache")))
        {
            node_fs.mkdirSync(node_path.join(syncPath,"cache"));
        }
        systemConfig["syncPath"] = syncPath;
        systemConfig["autoStart"] = document.getElementById("input_systemStart").checked;
        systemConfig["debug"] = document.getElementById("input_systemDebug").checked;
        systemConfig["scanInterval"] = document.getElementById("input_scanInterval").value;
        
        node_fs.writeFile(systemConfigPath, JSON.stringify(systemConfig), (err) => {
            if (err) {
                console.log(err);
                return;
            }});
        ipcRenderer.send('main', {"type":"reload","data":"all"})
    }
}

function startGame(id)
{
    ipcRenderer.send('background-sync', {"type":"sync","data":id})
    sleep(2000);//sleep 2sec, to sync files before game start
    item = data["games"][id];
    item["installed"].forEach(function(pc)
    {
        if(pc["name"] == hostname)
        {
            let fileData = node_path.parse(pc["startPath"])
            let promise = new Promise((resolve, reject) => {
                node_exec(fileData["base"], item["startArgs"], { cwd: fileData["dir"] }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
        
            });
        }
    });
}


function showGameModal(id)
{
    if(id != -1)
    {
        item = data["games"][id];
        item["installed"].forEach(function(pc)
        {
            if(pc["name"] == hostname)
            {
                document.getElementById("input_gameExe").value = pc["startPath"];
                document.getElementById("input_gameSave").value = pc["savePath"];
            }
        });
        document.getElementById("input_gameName").value = item["name"];
        document.getElementById("input_gameImg").value = item["img"];
        document.getElementById("input_gameArgs").value = item["startArgs"].join(" ");
        document.getElementById("input_gameSync").checked = item["enableSync"];
    }
    else
    {
        document.getElementById("input_gameExe").value = "";
        document.getElementById("input_gameSave").value = "";
        document.getElementById("input_gameName").value = "";
        document.getElementById("input_gameImg").value = "";
        document.getElementById("input_gameArgs").value = "";
        document.getElementById("input_gameSync").checked = false;
    }
    document.getElementById("modal_gameID").value = id;
    $('#modalGameSettings').modal('show');
}

function saveGameSettings()
{
    let id = document.getElementById("modal_gameID").value;
    let gameName = document.getElementById("input_gameName").value;

    if(id == -1)
    {
        //if this is a new game
        id = data["games"].length;
        data["games"][id] = {};
        data["games"][id]["installed"] = [];
        data["games"][id]["play7"] = 0;
        data["games"][id]["playTotal"] = 0;
        data["games"][id]["lastDate"] = "Never";

        if(!node_fs.existsSync(node_path.join(exchangeFolderPath,"saves",gameName)))
        {
            node_fs.mkdirSync(node_path.join(exchangeFolderPath,"saves",gameName));
        }
    }

    data["games"][id]["name"] = gameName;
    
    gameImgPath = document.getElementById("input_gameImg").value;
    gameImgName = node_path.parse(gameImgPath)["base"]
    if(!node_fs.existsSync(node_path.join(exchangeFolderPath,"cache",gameImgPath)))
    {
        node_fs.copyFile(gameImgPath, node_path.join(exchangeFolderPath,"cache",gameImgName), (err) => {
        });
    }0
    data["games"][id]["img"] = gameImgName;
    
    data["games"][id]["startArgs"] = document.getElementById("input_gameArgs").value.split(" ");
    data["games"][id]["enableSync"] = document.getElementById("input_gameSync").checked;
    gameExecPath = node_path.parse(document.getElementById("input_gameExe").value);
    data["games"][id]["processName"] = gameExecPath["base"];

    
    i = 0;
    posPC = data["games"][id]["installed"].length;
    while(i<data["games"][id]["installed"].length)
    {
        if(data["games"][id]["installed"][i]["name"] == hostname)
        {
            posPC = i;
        }
        i++;
    }

    if(posPC == data["games"][id]["installed"].length)
    {
        //if this is a new pc
        data["games"][id]["installed"][posPC] = {};
    }
    data["games"][id]["installed"][posPC]["name"] = hostname;
    data["games"][id]["installed"][posPC]["startPath"] = document.getElementById("input_gameExe").value;
    data["games"][id]["installed"][posPC]["savePath"] = document.getElementById("input_gameSave").value;

    node_fs.writeFile(node_path.join(exchangeFolderPath,'data.json'), JSON.stringify(data), (err) => {
        if (err) {
            console.log(err);
            return;
        }});
        ipcRenderer.send('main', {"type":"reload","data":"all"})
}

function openDialog(id,type)
{
    if(type == 1)
    {
        document.getElementById(id).value = dialog.showOpenDialog({ properties: ['openDirectory'] })[0];
    }
    else if(type == 2)
    {
        document.getElementById(id).value = dialog.showOpenDialog({ properties: ['openFile'],defaultPath:node_path.join(exchangeFolderPath,"cache") })[0];
    }
    else
    {
        document.getElementById(id).value = dialog.showOpenDialog({ properties: ['openFile'] })[0];
    }
}

function openSyncFolder()
{
    shell.openItem(exchangeFolderPath);
}

function makeCard(id,name,img,text)
{
    var imgPath = node_path.join(exchangeFolderPath,"cache",img);
    var html = "<div class=\"card text-white bg-dark ml-4 mt-2\" style=\"width: 12rem;\" id=\"card"+id+"\" onmouseover=\"onMouseIn('"+id+"')\" onmouseleave=\"onMouseOut('"+id+"')\">";
         html += "<img class=\"card-img-top\" src=\""+imgPath+"\" id=\"card"+id+"_img\" height=\"270px\"/>";
         html += "<div id=\"card"+id+"_btns\" style=\"display:none;\">";
            html += "<button type=\"button\" class=\"btn btn-success btnImg1\" id=\"card"+id+"_playBtn\" onclick=\"startGame("+id+")\">PLAY</button>";
            html += "<button type=\"button\" class=\"btn btn-secondary btnImg2\" onclick=\"showGameModal("+id+")\">Settings</button>";
         html += "</div>";
         html += "<div class=\"progress\" style=\"height: 5px;\">";
            html += "<div class=\"progress-bar progress-bar-striped progress-bar-animated bg-info\" role=\"progressbar\" id=\"card"+id+"_statusBar\" style=\"width: 100%\"></div>";
         html += "</div>";
         html += "<div class=\"card-footer\" id=\"card"+id+"_footer\">";
            html += "<p class=\"card-text\" style=\"font-size:12px;white-space:nowrap;overflow:hidden;\" data-toggle=\"tooltip\" data-html=\"true\" data-placement=\"top\" id=\"card"+id+"_gameTitle\" title=\""+text+"\">"+name+"</p>";
         html += "</div>";
        html += "</div>";

    return html;
}

function onMouseIn(id)
{
  var name = "card"+id;
  var footer = document.getElementById(name+"_footer");
  if(!footer.classList.contains("bg-primary"))
  {
    var card = document.getElementById(name);
    var btns = document.getElementById(name+"_btns");
    btns.style = "";
    var img = document.getElementById(name+"_img");
    img.style = "filter: brightness(50%);";
    footer.classList.add("bg-success");
    card.style = "width: 12rem;box-shadow: 5px 5px 5px 5px #222;"
  }
}

function onMouseOut(id)
{
  var name = "card"+id;
  var footer = document.getElementById(name+"_footer");
  if(footer.classList.contains("bg-success"))
  {
    var card = document.getElementById(name);
    var btns = document.getElementById(name+"_btns");
    btns.style = "display:none;";
    var img = document.getElementById(name+"_img");
    img.style = "filter: brightness(100%);";
    footer.classList.remove("bg-success");
    card.style = "width: 12rem;"
  }
}
