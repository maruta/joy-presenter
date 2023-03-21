const { mouse, Point, keyboard, Key, Button, screen } = require('@nut-tree/nut-js')

mouse.config.autoDelayMs = 3
keyboard.config.autoDelayMs = 3
let buffButtons

let gp = []
let mpHistory = [], mpFreeze = 0
let screenWidth
let screenHeight
let laserPointer = false;
let pointerActive = true;
function gameLoop() {
  mouse.getPosition().then(
    (mp) => {
      mpHistory.push(mp)
      if (mpHistory.length > 5) {
        mpHistory.shift()
      }
      if ('gyro' in gp) {
        let vx = gp.left ? -gp.gyro[2] : gp.gyro[2]
        let vy = gp.left ? gp.gyro[1] : -gp.gyro[1]
        /*        let ax = gp.accel[0];
                let ay = gp.accel[1];
                let az = gp.accel[2];
                let gx = gp.gyro[0];
                let gy = gp.gyro[1];
                let gz = gp.gyro[2];
                let roll = Math.atan2(ay,az);
                let pitch = Math.atan2(ax,az);
                let Cr = Math.cos(roll);
                let Sr = Math.sin(roll);
                let Cp = Math.cos(pitch);
                let Sp = Math.sin(pitch);
                let vy = Cr*gy-Sr*gz;
                let vx = -(Sr/Cp*gy+Cr/Cp*gz);*/

        let deadzone = (v, d) => {
          let s = Math.sign(v)
          let a = Math.abs(v)
          a = Math.max(a - d, 0)
          return s * a
        }
        vx = deadzone(vx, 2)
        vy = deadzone(vy, 2)
        if (mpFreeze == 0) {
          if (pointerActive) {
            mouse.setPosition(new Point(mp.x + vx, mp.y + vy))
          }
        } else {
          mpFreeze--
        }
      }

      if ('buttons' in gp) {
        let buttons = []
        if (buffButtons == undefined) {
          buffButtons = gp.buttons
        }
        for (let i = 0; i < gp.buttons.length; i++) {
          buttons[i] = (gp.buttons[i] ? 1 : 0) - (buffButtons[i] ? 1 : 0)
        }
        let rightButton = buttons[6] + buttons[22]
        let centerButton = buttons[7] + buttons[23]
        let leftButton = buttons[10] + buttons[11]

        if (rightButton != 0 || leftButton != 0 || centerButton != 0) {
          mouse.setPosition(mpHistory[0])
          mpFreeze = 5
        }

        if (rightButton > 0) {
          mouse.pressButton(Button.RIGHT)
        }
        if (rightButton < 0) {
          mouse.releaseButton(Button.RIGHT)
        }

        if (leftButton > 0) {
          mouse.pressButton(Button.LEFT)
        }
        if (leftButton < 0) {
          mouse.releaseButton(Button.LEFT)
        }

        pointerActive = gp.buttons[7] + gp.buttons[23] > 0
        if (centerButton > 0) {
          // console.log()
          // mouse.setPosition(new Point(screenWidth/2,screenHeight/2))
        }

        let parseKey = (btn, ...keys) => {
          if (btn > 0) {
            keyboard.pressKey(...keys)
          }
          if (btn < 0) {
            keyboard.releaseKey(...keys)
          }
        }
        if (centerButton != 0) {
          keyboard.pressKey(Key.LeftControl, Key.L)
          keyboard.releaseKey(Key.LeftControl, Key.L)
        }
        parseKey(buttons[1] + buttons[17], Key.Up)
        parseKey(buttons[2] + buttons[16], Key.Down)
        parseKey(buttons[0] + buttons[19], Key.Left)
        parseKey(buttons[3] + buttons[18], Key.Right)
        parseKey(buttons[8] + buttons[9], Key.Add)
        parseKey(buttons[12] + buttons[13], Key.LeftControl, Key.Enter)
        //parseKey(centerButton, Key.LeftControl, Key.H)
        parseKey(buttons[5] + buttons[20], Key.G)
        parseKey(buttons[4] + buttons[21], Key.LeftSuper, Key.Tab)
        buffButtons = gp.buttons
      }


      if ('axes' in gp) {
        let vx = gp.axes[0]
        let vy = gp.axes[1]

        vx = Math.sign(vx) * Math.pow(2, Math.abs(vx) * 5.5)
        vy = Math.sign(vy) * Math.pow(2, Math.abs(vy) * 5.5)

        if (vy < 0) {
          mouse.scrollDown(-vy)
        }
        if (vy > 0) {
          mouse.scrollUp(vy)
        }
        if (vx < 0) {
          mouse.scrollRight(-vx)
        }
        if (vx > 0) {
          mouse.scrollLeft(vx)
        }

      }

    })

  window.requestAnimationFrame(gameLoop)
}

async function getJoyCon() {
  screenHeight = await screen.height()
  screenWidth = await screen.width()
  const DOMreport = document.getElementById("report")
  const filters = [
    {
      vendorId: 0x057e, // Nintendo Co., Ltd
      productId: 0x2006 // Joy-Con Left
    },
    {
      vendorId: 0x057e, // Nintendo Co., Ltd
      productId: 0x2007 // Joy-Con Right
    }
  ]
  const [device] = await navigator.hid.requestDevice({ filters })
  let stickOffset = [], gyroOffset = [0, 0, 0], gyro = [0, 0, 0]
  device.addEventListener('inputreport', (event) => {
    const { data, device, reportId } = event;
    if (reportId != 0x30) {
      console.log(reportId)
      return
    }
    let buttonsStr = 'buttons: '
    let buttons = []
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 8; j++) {
        buttons[i * 8 + j] = Boolean((0x01 << j) & data.getUint8(i + 3 - 1))
        buttonsStr += buttons[i * 8 + j] ? 'o' : '.'
      }
      buttonsStr += '|'
    }

    let sticksStr = 'sticks: '
    let axes = []
    const left = (device.productId == 0x2006)
    const lrStr = "type: " + (left ? "Joy-Con (L)" : "Joy-Con (R)")
    const base = (left ? 6 : 9) - 1
    let d = new Uint8Array(data.buffer.slice(base, base + 4))
    stick_horizontal = d[0] | ((d[1] & 0xF) << 8);
    stick_vertical = (d[1] >> 4) | (d[2] << 4);

    if (stickOffset.length == 0) {
      stickOffset = [stick_horizontal, stick_vertical]
    }

    let stickCurve = (v) => {
      let s = Math.sign(v)
      let a = Math.abs(v)
      a = Math.max(a - 256, 0)
      a = Math.min(a, 768)
      return s * a / 768
    }
    axes[0] = stickCurve(stick_horizontal - stickOffset[0])
    axes[1] = stickCurve(stick_vertical - stickOffset[1])
    sticksStr += stick_horizontal + ', ' + stick_vertical + ' | ' + axes[0].toFixed(2) + ', ' + axes[1].toFixed(2)

    let battLevel = (data.getUint8(2 - 1) & 0xf0) >> 4
    let battLevelStr = "batt. level : " + battLevel

    let accel = [], accelStr = 'accel : '
    for (let i = 0; i < 3; i++) {
      accel[i] = data.getInt16(i * 2 + 13 - 1, true) * 0.000244 / 4
      accelStr += accel[i].toFixed(2) + ', '
    }

    let gyroStr = 'gyro : '
    for (let j = 2; j >= 0; j--) {
      for (let i = 0; i < 3; i++) {
        const rawGyro = data.getInt16(i * 2 + 19 - 1 + j * 12, true) * 0.06103 / 4
        gyro[i] = gyro[i] * 0.8 + 0.2 * (rawGyro - gyroOffset[i])
        gyroOffset[i] = gyroOffset[i] * 0.9999 + 0.0001 * rawGyro
        if (j == 0) {
          gyroStr += gyro[i].toFixed(2) + ', '
        }
      }
    }

    gp = {
      gyro,
      accel,
      axes,
      buttons,
      left,
      battLevel
    }
    DOMreport.innerText = lrStr + '\n' + battLevelStr + '\n' + buttonsStr + '\n' + sticksStr + '\n' + accelStr + '\n' + gyroStr
  })

  console.log(device)
  if (!device.opened) {
    await device.open();
  }

  let globalPacketNumber = 0x00;
  const createQuery = (subCommand, subCommandArguments) => {
    const query = new Array(48).fill(0x00);
    query[0] = globalPacketNumber % 0x10;
    query[1] = 0x00;
    query[2] = 0x01;
    query[5] = 0x00;
    query[6] = 0x01;
    query[9] = subCommand
    for (let i = 0; i < subCommandArguments.length; i++) {
      query[10 + i] = subCommandArguments[i];
    }

    globalPacketNumber++

    return Uint8Array.from(query)
  }

  const delay = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs));

  await device.sendReport(0x01, createQuery(0x40, [0x01])) // enable IMU
  await delay(100)
  await device.sendReport(0x01, createQuery(0x41, [1, 2, 1, 1])) //set IMU sensitivity
  await delay(100)
  await device.sendReport(0x01, createQuery(0x03, [0x30])) // set input report mode to standard full mode
}

window.onload = function () {
  document.getElementById('connect-joycon').onclick = () => {
    getJoyCon()
  }
  gameLoop()
}
