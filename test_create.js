const fetch = require('node-fetch');
const fs = require('fs');

async function run() {
  const env = fs.readFileSync('.env', 'utf8');
  // Need to get a valid token. Or we can just use the backend service directly.
  
  // Actually, I can just call the VehiclesService directly!
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('./src/app.module');
  const { VehiclesService } = require('./src/vehicles/vehicles.service');

  const app = await NestFactory.createApplicationContext(AppModule);
  const vehiclesService = app.get(VehiclesService);

  const newVehicle = await vehiclesService.createVehicle({
    make: 'TestMake',
    model: 'TestModel',
    year: 2026,
    retail_price_etb: 1000000,
    fuel: 'ELECTRIC',
    duty: 'DUTY_PAID',
    status: 'SOURCING',
    images: ['https://example.com/test-image.jpg']
  });

  console.log('Created Vehicle:', newVehicle);
  await app.close();
}

run().catch(console.error);
