import osUtils from 'os-utils'
import os from 'os';
import fs from 'fs';
const POLLING_INTERVAL = 500;

export function pollResources(){
    setInterval(async () => {
    const cpuUsage = await getCpuUsage();
    const ramUsage = getRamUsage();
    const storageData = getStorageData();
    console.log({cpuUsage,ramUsage,storageData})
    },POLLING_INTERVAL)
}

function getCpuUsage(){
    return new Promise((resolve) => {
        osUtils.cpuUsage((percent) => {
            console.log(percent)
            resolve(percent)
        })
    })
}

function getStorageData() {
  try {
    // requires node 18
    const stats = fs.statfsSync(process.platform === 'win32' ? 'C://' : '/');
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bfree;

    return {
      total: Math.floor(total / 1_000_000_000),
      usage: 1 - free / total,
    };
  } catch (error) {
    console.error('Error getting storage data:', error);
    return { total: 0, usage: 0 };
  }
}

function getRamUsage() {
    return 1 - osUtils.freememPercentage();
}

export function getStaticData() {
    const totalStorage = getStorageData().total;
    const cpuModel = os.cpus()[0].model;
    const totalMemoryGB = Math.floor(osUtils.totalmem() / 1024);
  
    return {
      totalStorage,
      cpuModel,
      totalMemoryGB,
    };
}
