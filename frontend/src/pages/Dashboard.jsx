import { useEffect, useState } from "react";

import socket from "../services/socket";

import SensorCard from "../components/SensorCard";

function Dashboard() {
  const [sensorData, setSensorData] = useState({
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0,
    moisture: 0,
  });

  const [alerts, setAlerts] =
    useState([]);

  useEffect(() => {
    socket.on("sensor-data-created", (payload) => {
      console.log("REALTIME MASUK");
      console.log(payload);

      setSensorData({
        nitrogen: payload.data.npk.nitrogen,
        phosphorus: payload.data.npk.phosphorus,
        potassium: payload.data.npk.potassium,
        moisture: payload.data.moisture,
      });
    });

    socket.on(
        "alert-update",
        (alert) => {
            console.log(alert);

            setAlerts((prev) => [
            alert,
            ...prev,
            ]);
        }
    );

    console.log(sensorData);
    return () => {
      socket.off("sensor-data-created");
    };
  }, []);

  return (
    <div
        style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "24px",
        fontFamily: "Arial",
        }}
    >
        <h1
        style={{
            fontSize: "32px",
            color: "#2f855a",
            marginBottom: "8px",
        }}
        >
        Monitoring Screenhouse
        </h1>

        <p
        style={{
            color: "#6b7280",
            marginBottom: "24px",
        }}
        >
        Data sensor realtime pembibitan padi
        </p>

        <div
        style={{
            display: "grid",
            gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
        }}
        >
        <SensorCard
            title="Nitrogen"
            value={sensorData.nitrogen}
            unit="N"
        />
        </div>

        {/* ALERT REALTIME */}

        <div
        style={{
            marginTop: "30px",
        }}
        >
        <h2
            style={{
            color: "#b91c1c",
            marginBottom: "16px",
            }}
        >
            Alert Realtime
        </h2>

        {alerts.length === 0 && (
            <p>
            Belum ada alert
            </p>
        )}

        {alerts.map(
            (alert, index) => (
            <div
                key={index}
                style={{
                backgroundColor:
                    "#fee2e2",
                padding: "16px",
                borderRadius: "12px",
                marginBottom: "12px",
                }}
            >
                <strong>
                {alert.message}
                </strong>

                <p>
                Screenhouse ID:
                {alert.screenhouseId}
                </p>
            </div>
            )
        )}
        </div>
    </div>
    );
}

export default Dashboard;