const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper function to generate mock timeseries data
const generateTimeSeries = (hours = 24) => {
  const data = [];
  let currentHour = new Date().getHours();
  
  for (let i = 0; i < hours; i++) {
    const time = `${(currentHour + i) % 24}:00`;
    data.push({
      time,
      solar: Math.max(0, Math.sin(Math.PI * (i - 6) / 12) * 5000 + Math.random() * 500),
      wind: 2000 + Math.random() * 1500,
      demand: 4000 + Math.sin(Math.PI * (i - 8) / 12) * 1000 + Math.random() * 500,
      price: 50 + Math.sin(Math.PI * (i - 12) / 12) * 20 + Math.random() * 10,
      batteryState: 30 + Math.sin(Math.PI * i / 12) * 40,
      ccesState: 40 + Math.cos(Math.PI * i / 12) * 30
    });
  }
  return data;
};

// 1. FORECASTING API
app.get('/api/forecast', (req, res) => {
  res.json(generateTimeSeries());
});

// 2. STATE ENGINE API
let systemState = {
  batterySoc: 45, // %
  ccesState: 60, // %
  co2Inventory: 1200 // tonnes
};

app.get('/api/state', (req, res) => {
  // Add slight random fluctuation for realism
  systemState.batterySoc += (Math.random() - 0.5) * 0.5;
  systemState.ccesState += (Math.random() - 0.5) * 0.2;
  systemState.co2Inventory += Math.random() * 2;
  
  // Keep within bounds
  systemState.batterySoc = Math.min(Math.max(systemState.batterySoc, 0), 100);
  systemState.ccesState = Math.min(Math.max(systemState.ccesState, 0), 100);
  
  res.json(systemState);
});

// 3. OPTIMIZATION & ECONOMICS API
app.post('/api/optimize', (req, res) => {
  const { renewableAvailable, demand, price } = req.body;
  
  let batteryCharge = 0;
  let ccesCharge = 0;
  let gridExport = 0;
  let curtailment = 0;
  let costAvoided = 0;
  let arbitrageRevenue = 0;
  
  const surplus = renewableAvailable - demand;
  
  if (surplus > 0) {
    if (systemState.batterySoc < 90) {
      batteryCharge = Math.min(surplus, 1000);
    }
    
    let remainingSurplus = surplus - batteryCharge;
    
    if (remainingSurplus > 0 && systemState.ccesState < 90) {
      ccesCharge = Math.min(remainingSurplus, 2000);
    }
    
    remainingSurplus -= ccesCharge;
    
    if (remainingSurplus > 0) {
      if (price > 60) {
        gridExport = remainingSurplus; // Sell if price is good
        arbitrageRevenue = gridExport * (price / 1000);
      } else {
        curtailment = remainingSurplus; // Otherwise curtail
      }
    }
  }

  // Calculate some economic metrics
  costAvoided = Math.min(renewableAvailable, demand) * (price / 1000);

  res.json({
    allocation: {
      industrialLoad: Math.min(renewableAvailable, demand),
      batteryCharge,
      ccesCharge,
      gridExport,
      curtailment
    },
    economics: {
      costAvoided,
      arbitrageRevenue,
      co2Captured: systemState.co2Inventory * 0.1 // Simulated daily capture
    }
  });
});

// 4. DIGITAL TWIN SIMULATION
app.get('/api/digital-twin', (req, res) => {
  // Returns a full 24h simulation of states
  const simulation = generateTimeSeries();
  res.json(simulation);
});

app.listen(PORT, () => {
  console.log(`Intelligent Energy-Carbon Orchestration Backend running on port ${PORT}`);
});
