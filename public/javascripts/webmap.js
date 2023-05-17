(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var map = L.map('map').setView([14.6539, 121.0685], 13);
var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
var aqiPolygons, excludePolygons, info, legend, router;
var plan = L.Routing.plan(
    [
        L.latLng(14.6539, 121.0685),
        L.latLng(14.574 , 121.052)
    ],{
    geocoder: L.Control.Geocoder.nominatim(),
    waypointNameFallback: function(latLng) {
        function zeroPad(n) {
            n = Math.round(n);
            return n < 10 ? '0' + n : n;
        }
        function sexagesimal(p, pos, neg) {
            var n = Math.abs(p),
                degs = Math.floor(n),
                mins = (n - degs) * 60,
                secs = (mins - Math.floor(mins)) * 60,
                frac = Math.round((secs - Math.floor(secs)) * 100);
            return (n >= 0 ? pos : neg) + degs + '°' +
                zeroPad(mins) + '\'' +
                zeroPad(secs) + '.' + zeroPad(frac) + '"';
        }

        return sexagesimal(latLng.lat, 'N', 'S') + ' ' + sexagesimal(latLng.lng, 'E', 'W');
    }
    });

var layerControl = L.control.layers(null,null,{collapsed:false}).addTo(map);

function LoadData(){
    fetch('../polygonized.json')
        .then(function (response) {
            console.log(response);
            return response.json();
        })
        .then(function (data) {
            var geojsonPolygon = data;
            var threshold = geojsonPolygon.threshold;
            var maxAQI = 0;
            var polygon_AQI = 0;
            for(var i=0; i < geojsonPolygon.features.length; i++){
                polygon_AQI = geojsonPolygon.features[i].properties.AQI;
                maxAQI = polygon_AQI != 32767 && polygon_AQI > maxAQI ? polygon_AQI : maxAQI;
            };

            function getColor(d) {
                redval = (d > maxAQI/2) ? 1 : redval = 2*d/maxAQI;
                var hexred = (Math.floor(redval*255)).toString(16);
                hexred = hexred.length == 1 ? '0'.concat(hexred) : hexred;
                greval = (d < maxAQI/2) ? 1 : 2*(1-(d/maxAQI));
                var hexgre = Math.floor((greval*255)).toString(16);
                hexgre = hexgre.length == 1 ? '0'.concat(hexgre) : hexgre;
                var hex = "#".concat(hexred,hexgre,'00');
                //alert(hex)
                return hex;
            }
            function style(feature) {
                return {            // highlight black if >= threshold
                    fillColor: feature.properties.AQI >= threshold ? '#000000' : getColor(feature.properties.AQI),
                    weight: 0,
                    opacity: 1,
                    color: 'white',
                    dashArray: '2',
                    fillOpacity: 0.5
                };
            }
            function highlightFeature(e) {
                var layer = e.target;
                layer.setStyle({
                    weight: 1,
                    color: '#666',
                    dashArray: '',
                    fillOpacity: 0.7
                });
                layer.bringToFront();
                info.update(layer.feature.properties.AQI.toString());
            }
            function resetHighlight(e) {
                var layer = e.target;
                aqiPolygons.resetStyle(layer);
                info.update();
            }
            function zoomToFeature(e) {
                map.fitBounds(e.target.getBounds());
                //alert(threshold);                     # debugging
            }
            function onEachFeature(feature, layer) {
                layer.on({
                    mouseover: highlightFeature,
                    mouseout: resetHighlight,
                    click: zoomToFeature
                });
            }

            if(aqiPolygons){
                layerControl.removeLayer(aqiPolygons);
                map.removeLayer(aqiPolygons);
            }
            aqiPolygons = L.geoJson(geojsonPolygon, {
                style: style,
                onEachFeature: onEachFeature
            });
            layerControl.addOverlay(aqiPolygons, "AQI polygons");
            aqiPolygons.addTo(map);

            // L.geoJSON(geojsonPolygon, {
            //     onEachFeature: function(feature, featureLayer) {
            //     featureLayer.bindPopup(feature.properties.AQI.toString());
            //     }}).addTo(map);

            if(info){
                map.removeControl(info);
            }
            info = L.control({position: 'bottomright'});
            info.onAdd = function (map) {
                this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
                this.update();
                return this._div;
            };
            // method that we will use to update the control based on feature properties passed
            info.update = function (props) {
                this._div.innerHTML = '<h4>US AQI Levels</h4>' +  (props ?
                    '<b>' + props + '</b> US AQI'
                    : 'Hover over an area');
            };
            info.addTo(map);

            if(legend){
                map.removeControl(legend);
            }
            legend = L.control({position: 'bottomleft'});
            legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'info legend'),
                    grades = [0, 1*maxAQI/7, 2*maxAQI/7, 3*maxAQI/7, 4*maxAQI/7, 5*maxAQI/7, 6*maxAQI/7],
                    labels = [];
                // loop through our density intervals and generate a label with a colored square for each interval
                for (var i = 0; i < grades.length; i++) {
                    div.innerHTML +=
                        '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
                        Math.round(grades[i]) + (grades[i + 1] ? '&ndash;' + Math.round(grades[i + 1]) + '<br>' : '+ <br>');
                }
                div.innerHTML +=
                    '<i style="background:' + '#000000' + '"></i> ' + threshold + '+' + ' (threshold)'; // black legend for threshold
                return div;
            };
            legend.addTo(map);
        })
        .catch(function (err) {
            console.log('error: ' + err);
        });

    fetch('../filtered.json')
        .then(function (response) {
            console.log(response);
            return response.json();
        })
        .then(function (data) {
            var geojsonPolygon = data;
            var coords = '';
            coords = geojsonPolygon["features"][0]["geometry"]["coordinates"];

            if(excludePolygons){
                layerControl.removeLayer(excludePolygons);
                map.removeLayer(excludePolygons);
            }
            excludePolygons = L.geoJSON(geojsonPolygon, {color: 'black'});
            layerControl.addOverlay(excludePolygons, "Excluded Polygon");
            excludePolygons.addTo(map);

            if(router){
                map.removeControl(router);
            }

            router = L.Routing.control({
                router: L.Routing.valhalla('','pedestrian',coords,''),
                formatter: new L.Routing.Valhalla.Formatter(),
                routeWhileDragging: false,
                fitSelectedRoutes: false,
                plan: plan
            }
            ).addTo(map);
        
        })
        
        .catch(function (err) {
            console.log('error: ' + err);
        });
}
LoadData();
setInterval(function(){LoadData();},30 * 1000);
},{}]},{},[1]);
