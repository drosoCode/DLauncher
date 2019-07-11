
const {app, BrowserWindow, ipcMain, Tray, Menu } = require('electron')
const node_path = require('path');
const node_fs = require('fs');


let mainWindow
let backgroundSyncWindow
let backgroundProcessWindow
let debug = true
let isMainVisible = false

function createWindow () 
{
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 600,
    icon: node_path.join(__dirname,"res","icon.ico"),
    webPreferences: {
      nodeIntegration: true
    }
  })

  //remove menu bar from browser
  mainWindow.setMenu(null);

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

    // Open the DevTools.
    if(debug)
    {
        mainWindow.webContents.openDevTools()
    }

    var appIcon = new Tray(node_path.join(__dirname, 'res/icon.ico'))

    var contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show', click: function () {
                mainWindow.show()
            }
        },
        {
            label: 'Quit', click: function () {
                app.isQuiting = true
                app.quit()
            }
        }
    ])

    appIcon.setContextMenu(contextMenu)
    
    //window action listeners
      mainWindow.on('close', function (event) {
        if(!app.isQuiting)
        {
            event.preventDefault();
            if(isMainVisible)
            {
              isMainVisible = false
              appIcon.setHighlightMode('never')
              mainWindow.hide();
            }
        }
      })
      
      mainWindow.on('minimize', function (event) {
            event.preventDefault()
            if(isMainVisible)
            {
              isMainVisible = false
              appIcon.setHighlightMode('never')
              mainWindow.hide();
            }
      })
      
      mainWindow.on('show', function () {
          if(!isMainVisible)
          {
            isMainVisible = true
            appIcon.setHighlightMode('always')
            mainWindow.show()
          }
      })

      mainWindow.show();
  
}

// Create a hidden background window
function createBgProcessWindow() {
  backgroundProcessWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    "show": debug
  })
  backgroundProcessWindow.loadFile('process.html')
  backgroundProcessWindow.webContents.openDevTools()

  backgroundProcessWindow.on('close', () => {
      backgroundProcessWindow.hide();
      console.log('background process window hidden')
  });
}

// Create a hidden background window
function createBgSyncWindow() {
  backgroundSyncWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    "show": debug
  })
  backgroundSyncWindow.loadFile('sync.html')
  backgroundSyncWindow.webContents.openDevTools()

  backgroundSyncWindow.on('close', () => {
      backgroundSyncWindow.hide();
      console.log('background sync window hidden')
  });
}


app.on('ready', function(){
  let systemConfig = JSON.parse(node_fs.readFileSync(node_path.join(__dirname, 'config.json')));
  debug = systemConfig["debug"]
  createBgProcessWindow();
  createBgSyncWindow();
  createWindow();
})

app.requestSingleInstanceLock()
app.on('second-instance', (event, argv, cwd) => {
  app.isQuiting = true
  app.quit()
})


//ipc listeners

ipcMain.on('main', (event, arg) => {
    if(arg["type"] == "reload")
    {
      backgroundProcessWindow.reload()
      backgroundSyncWindow.reload()
      mainWindow.reload()
    }
    else if(arg["type"] == "quit")
    {
      app.isQuiting = true
      app.quit()
    }
})

ipcMain.on('background-sync', (event, arg) => {
      backgroundSyncWindow.webContents.send('background-sync', arg);
})

ipcMain.on('background-process', (event, arg) => {
      backgroundProcessWindow.webContents.send('background-process', arg);
})

ipcMain.on('renderer', (event, arg) => {
      mainWindow.webContents.send('renderer', arg);
})

