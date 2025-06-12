import {app,BrowserWindow} from "electron"
import path from "path"
import { isDev } from "./utils.js"
import { pollResources } from "./resourceManager.js"

app.on("ready",() => {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })
    
    if(isDev()){
        mainWindow.loadURL('http://localhost:5123')
        mainWindow.webContents.openDevTools()
    }else {
        mainWindow.loadFile(path.join(app.getAppPath(),'dist-react/index.html'))
    }
    
    pollResources()
})
