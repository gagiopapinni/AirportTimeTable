
class TimeTable extends EventTarget {

     /*options [Object]

       fields:
           container_id          [String]            // id of an HTML container, included in dom tree
           apiKey                [String]            // aviation-edge.com api key
           airports              [Array]             // list of iata airport codes
           iataAirportDictionary [Object] OPTIONAL   // and object associating an iata airport code to its location 

       events: apiCallLimit, invalidKey, invalidAirportCode
             
     */
     constructor(options = {}){
         super();

         this._container = document.getElementById(options.container_id);

         this._KEY = options.apiKey || '';
 
         this._airports = options.airports || [];

         this._selected_airport;
         
         this._iataAirportDictionary = options.iataAirportDictionary || {} ;
         
         this._init_dom();

         this.update();
         
     }
     _init_dom(){
         this._container.innerHTML =
            `<div class='row '>

                  <div class='btn-group btn-group-toggle btn-group-lg mt-3' data-toggle='buttons'>
                      <label id='departure_btn' class='btn btn-secondary active'>
                         <input type='radio' name='options' checked> Departure
                      </label>
                      <label id='arrival_btn' class='btn btn-secondary'>
                         <input type='radio' name='options'> Arrival
                      </label>
                  
                  </div>
                  <div class='w-100'></div>
                  <div class="input-group mt-2  w-auto ">
                      <div class="input-group-prepend">
                          <label class="input-group-text" for="airport">Airport</label>
                      </div>
                      <select class="custom-select " id="airport"></select>
                  </div>
             </div>
             <div class='row mt-5'>
                  <input id='search_input' type="text" class="form-control col-12 col-md-8"
                                    placeholder="Search by flight number or airline">  
                                                        
                  <div class="input-group  col-12 col-md-4 ">
                      <div class="input-group-prepend">
                          <label class="input-group-text" for="filter">Filter</label>
                      </div>
                      <select class="custom-select" id="filter">
                               <option value='' selected>all</option>
                               <option>active</option>
                               <option>landed</option>
                               <option>scheduled</option>
                               <option>cancelled</option>
                               <option>redirected</option>
                               <option>diverted</option>
                               <option>incident</option>
                               <option>unknown</option>
                      </select>
                  </div>
             </div>
             <div class='row '>
                  <table class='table table-responsive-sm col-12 mx-auto' id='arrival_tbl' style='display:none;'></table>
                  <table class='table table-responsive-sm col-12 mx-auto' id='departure_tbl'></table>
             </div>
 
            `;

         const dep_btn = document.getElementById('departure_btn'),
               arr_btn = document.getElementById('arrival_btn'),
               arr_list = document.getElementById('arrival_tbl'),
               dep_list = document.getElementById('departure_tbl'),
               search = document.getElementById('search_input'),
               filter = document.getElementById('filter'),
               airport_select = document.getElementById('airport');

         for(let airport of this._airports){
               const option =  document.createElement('option');
               option.textContent = airport;
               airport_select.appendChild(option);
         }

         this._selected_airport = airport_select.value;

         airport_select.addEventListener('input',(e)=>{ 
                this._selected_airport = e.target.value;   
                this.update(); 
         })

         filter.addEventListener('input',(e)=>{
               this._filter([0,search.value],[3,e.target.value]);
         })

         search.addEventListener('input',(e)=>{
               this._filter([0,e.target.value],[3,filter.value]);
         })

         dep_btn.addEventListener('click',()=>{
              arr_list.style.display = 'none';
              dep_list.style.display = '';
         })

         arr_btn.addEventListener('click',()=>{
              arr_list.style.display = '';
              dep_list.style.display = 'none';
         })
         
     }
     
     update(){
        this._display("Loading");

        return this._get_data().then((data) =>{

                                    this._display(data);
                                    this._filter([0,document.getElementById('search_input').value],
                                                 [3,document.getElementById('filter').value]);

                                 })
                               .catch((e)=>{

                                    this._display();

                                    this._dispatch(e);

                                    throw e;

                                 });
     }
     _dispatch(e){
         switch(e){
           case 'Invalid API KEY': this.dispatchEvent(new Event('invalidKey'));break;
           case 'No Record Found': this.dispatchEvent(new Event('invalidAirportCode'));break;
           case 'Your API Call Limit is Over.': this.dispatchEvent(new Event('apiCallLimit'));break;
           //...
         }

     }
     _get_data (){
         return new Promise((resolve,reject)=>{

            const loaded = {arrival: false, departure: false},
                  data = {};      
         
            for(let type of ['arrival','departure']){

               const request = new XMLHttpRequest(); 
               request.addEventListener('load',(e)=>{
                      data[type] = JSON.parse(e.target.response);

                      //the api KEY or airport code might be invalid
                      if(data[type].error) reject(data[type].error.text);

                      if(data.arrival && data.departure) resolve(data);                    
               })

               request.open('GET','https://aviation-edge.com/v2/public/timetable?key='
                         +this._KEY+'&iataCode='+this._selected_airport+'&type='+type);
               request.send();
            }

          })
                               
     }


     _display (data = null){ 
         for(let type of ['arrival','departure']){

               const table = document.getElementById(type+'_tbl');

               let rows = `<tr>
                              <th>Flight</th> 
                              <th>Scheduled time</th>
                              <th>Airport</th>
                              <th>Status</th>
                           </tr>
                          `;

               
               if(typeof data === "string") rows+=`<p class='h1'>${data}</p>`; 
               else if(data && data[type])
                      for(let obj of data[type] )                  
                        rows += this._composeRow(obj,type)
                 
               

               table.innerHTML = rows;

               
         }

     }
     _composeRow (flight_obj,type){
         const secondaryText = (text)=> `<div class="mt-2 text-secondary">${text}</div>`,
               invert = (type)=> type==='departure'?'arrival':'departure',
               time = (flight_obj[type].scheduledTime || '').slice(11,16) 
                     + secondaryText((flight_obj[type].scheduledTime || '').slice(0,10)),
               flight = flight_obj.flight.iataNumber + secondaryText(flight_obj.airline.name) ,
               iataAirportCode = flight_obj[invert(type)].iataCode,
               dict = this._iataAirportDictionary,
               country = (dict[iataAirportCode] || {}).country || '',
               city = (dict[iataAirportCode] || {}).city || '',
               airport = iataAirportCode + secondaryText(city+', '+country),
               status = flight_obj.status + secondaryText(this._statusSpecificInformation(flight_obj)) ;   



         return `<tr>
                    <td>${flight}</td>
                    <td>${time}</td>
                    <td>${airport}</td>
                    <td>${status}</td>
                 </tr>
                `;  

     }
     _statusSpecificInformation(flight_obj){
          let info = '',time;
          const arr = flight_obj.arrival,
                dep = flight_obj.departure;

          switch (flight_obj.status){
            case 'landed':
               if(time = (arr.actualTime || arr.actualRunway))
                  info = 'arrived at '+time.slice(11,16);
               break;

            case 'active':
               if(time = (dep.actualTime || dep.actualRunway))
                  info='departed at '+time.slice(11,16);
               break;
            //...
          }
          return info;
       
     }
     
     _filter (...filters){ // filters: [ [column_number1, keyword1], ..., [column_numberN, keywordN] ]

         const rows =  Array.from(document.getElementById('arrival_tbl').getElementsByTagName('tr'))
                      .concat(Array.from(document.getElementById('departure_tbl').getElementsByTagName('tr'))); 

         for(let row of rows)
        
            row.style.display = this._doesRowMatch(row,...filters)?'':'none';
                             
     }

     _doesRowMatch(row, ...filters){
         for(let a of filters){
               const column_number = a[0],
                     keyword = a[1].toLowerCase(),
                     cell = row.getElementsByTagName('td')[column_number];

               if(cell){
                  const value = cell.textContent.toLowerCase();
                  if(value.indexOf(keyword) == -1) return false;
               }

         }
         return true;
     }

}












