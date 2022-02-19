const fs = require('fs');
const puppeteer = require('puppeteer');
const colors = require('colors/safe');

const config = require('./config.js');

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

async function gcode(){
  // ACCEDO A LA PAGINA WEB
  try{
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36');
    await page.setRequestInterception(false);
    await page.goto(`https://www.thuijzer.nl/image2gcode/`, {waitUntil: "load"});
    console.log(colors.cyan(`Accedo a la web`))

    // UNA VEZ ESTOY EN LA PAGINA WEB, INTENTO SUBIR LA IMAGEN.
    // PRIMERO BUSCARÉ SI TENGO ALGUNA IMAGEN DISPONIBLE EN LA CARPETA
    let archivos;
    for(var i=0 ; ; i++){
      console.log(colors.yellow(`Buscando imagen, fallido en el intento ${i+1}`))
      archivos = fs.readdirSync(config.imagen_gcode);
      if(archivos.length > 0) break;
      await sleep(1000);
    }

    // INTENTA CARGAR LA IMAGEN EN LA WEB
    try{
      const elementHandle = await page.$("input[type=file]");
      await elementHandle.uploadFile(`${config.imagen_gcode}/${archivos[0]}`);
      console.log(colors.green(`Subiendo imagen, conseguido`))
    }catch(e){ console.log(colors.yellow(`Subiendo imagen, fallido\n${e}`)); await sleep(1000); }

    // UNA VEZ HEMOS CARGADO LA IMAGEN, DEBEMOS HACER CLICK EN EL BOTON DE GENERAR EL GCODE
    try{
      await page.click("input[type=submit]");
      console.log(colors.cyan(`Hago click para generar gcode`))
    }catch(e){ console.log(colors.yellow(`Error haciendo click para generar gcode\n${e}`)); await sleep(1000); }

    // POR ULTIMO, DEJAMOS QUE CARGUE DURANTE UN PAR DE SEGUNDOS Y SCRAPEAMOS EL CODIGO RESULTANTE
    await sleep(5000);
    let codigos = [];
    for(var i=1 ; ; i++){
      try{
        let codigo = await page.waitForXPath(`/html/body/textarea/text()[${i}]`, {timeout: 3000})
        codigo = await page.evaluate(element => element.textContent, codigo)
        codigos.push(codigo)
      }catch(e){ console.log(colors.yellow(`No puedo obtener más codigos (obtengo ${i-1})\n${e}`)); break; }
    }

    // AHORA QUE YA TENGO EL CODIGO, DEBO EXPORTARLO A UN ARCHIVO
    fs.writeFileSync(config.codigo_gcode, codigos.join("\n"));

    // BORRAMOS EL ARCHIVO IMAGEN
    fs.unlink(`${config.imagen_gcode}/${archivos[0]}`, function(e) {
      if(e) console.log(colors.yellow(`No pude borrar el archivo\n${e}`));
      else console.log(colors.magenta(`Archivo borrado`));
    });

    // CERRAMOS EL NAVEGADOR PARA AHORRAR MEMORIA
    browser.close();
  }catch(e){ console.log(colors.red(`Error en la funcion principal gcode\n${e}`)); }
}
