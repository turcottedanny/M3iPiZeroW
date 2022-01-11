// Setup multi role support and two different adapters for Peripheral and Central
process.env['NOBLE_MULTI_ROLE'] = 1
process.env['NOBLE_REPORT_ALL_HCI_EVENTS'] = 1
process.env['BLENO_HCI_DEVICE_ID'] = 0
process.env['NOBLE_HCI_DEVICE_ID'] = 0

const noble = require('@abandonware/noble');
const keiserParser = require('./keiserParser.js');
const KeiserBLE = require('./BLE/keiserBLE');

var result = null;
var fillInTimer = null;
var dataToSend = null;
var targetDeviceId = -1;

console.log("Starting");

var keiserBLE = new KeiserBLE();

keiserBLE.on('advertisingStart', (client) => {
	//oled.displayBLE('Started');
});
keiserBLE.on('accept', (client) => {
	//oled.displayBLE('Connected');
});
keiserBLE.on('disconnect', (client) => {
	//oled.displayBLE('Disconnected');
});

noble.on('stateChange', async (state) => {
    console.log(`[Central] State changed to ${state}`);
    if (state === 'poweredOn') {
    	console.log(`[Central] starting scan`);
        await noble.startScanningAsync(null, true);
    } else if (state === 'poweredOff') {
		console.log('No adapter detected, exiting in 5 seconds');
		setTimeout(() => {
			process.exit();
		}, 5000);
    }
});

noble.on('scanStop', async () => {
	console.log("Restarting BLE Scan");
	try {
		await noble.startScanningAsync(null, true);
	} catch (err) {
		console.log("Unable to restart BLE Scan: " + err);
	}
});

function sendFillInData() {
	if (dataToSend) {
		console.log("Sending fill in data");
		keiserBLE.notifyClient(dataToSend);
		fillInTimer = setTimeout(sendFillInData, 500);
	} else {
		console.log("Aborting nothing to send");
	}
};

noble.on('discover', (peripheral) => {
   	//console.log(`[Central] Found device ${peripheral.advertisement.localName} ${peripheral.address}`);
	if (peripheral.advertisement.localName == "M3") {
		try {
			result = keiserParser.parseAdvertisement(peripheral);
			console.log(`Bike ${result.ordinalId}: RT: ${result.realTime} RPM: ${result.cadence} PWR: ${result.power} GEAR: ${result.gear} ET: ${result.duration}`);

			// Only continue if M3i is transmitting real-time data
			if (result.realTime) {
				// Only use data coming from target device; if no target device set then set it
				if (result.ordinalId != targetDeviceId) {
					if (targetDeviceId == -1) {
						console.log(`Attaching to bike id ${result.ordinalId}`);
						targetDeviceId = result.ordinalId;
						keiserBLE.setDeviceId(targetDeviceId);
					} else {
						return;
					}
				}

				// Assemble the data structure for the BLE service/characteristics to use
				dataToSend = {
						ftmsrpm: result.ftmscadence,
						power: result.power,
				};

				// Reset the fill-data timer if it is set
				if (fillInTimer) {
					clearTimeout(fillInTimer);
					fillInTimer = null;
				}
				// Pass data to services/characteritcs to process and send to client; set a timer for fill-data
				keiserBLE.notifyClient(dataToSend);
				fillInTimer = setTimeout(sendFillInData, 500);
			}
		}
		catch (err) {
			console.log(`\tError parsing: ${err}`);
			console.log(`\t ${err.stack}`);
		}
	}
});

function emulate () {
	return setInterval(() => {
		let rpm = Math.floor(Math.random()*10)+180;
		let power = Math.floor(Math.random()*10)+120;

		keiserBLE.notifyClient({
			ftmsrpm: rpm,
			power,
		});

	}, 500);
}


