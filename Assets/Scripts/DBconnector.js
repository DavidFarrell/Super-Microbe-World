#pragma strict

//Imports
import Boomlagoon.JSON;
//import UnityEngine;

//var port: int;

public class DBconnector extends MonoBehaviour{
	
	public var url: String = "http://localhost:3030";		//adress and port of the database server

	private var sessionkey: String = 'empty';

	@HideInInspector
	var connected: boolean = false;			//This variable should be checked after connecting with 
	
	private var debugMode = true;			//if true, a lot of information will be displayed in the console about the progress of the instructions
	
	public function Start(){
		
	}
	
	public function Update(){
		
	}
	
	/**
	*	userID: the UserId of the database document usersession {session, userId, ip}
	*	session: The session in which we are playing the game. Will be part of the url when trying to connect to the server.
	*            This session has to exist in the server in order to establish the connection.
	*	
	*/
	public function ConnectToGleaner (userID: String, session: String){//: Object{
		Debug.Log("Beginning the connection to the DB");
		
		if (PlayerPrefs.HasKey("sessionKey")) PlayerPrefs.DeleteKey("sessionKey");		//just to make sure
		
		/*Creating the heades for the http get request*/
		var headers = new Hashtable();
		headers.Add("Authorization", userID);
		
		/*Sending the request*/
		if(debugMode) Debug.Log('DBConnector.EstablishConnection() -> Beginning connection...');
		var www = new WWW(url + "/start/"+session, null, headers);
		yield www;
		
		/*Dealing with the response*/
		if (!String.IsNullOrEmpty(www.error))
	        Debug.Log('DBConnector.EstablishConnection() -> Error in the http response' + www.error);
	    else{
	    	if (www.text){
	        	var resJSON : JSONObject = JSONObject.Parse(www.text);					//resJSON should contain the parsed JSON if there hasn't been errors
	        	if(debugMode) Debug.Log('DBConnector.EstablishConnection() -> Connection established');
	        	if (resJSON.ContainsKey('sessionKey')){
	        		
	        		sessionkey = resJSON.GetValue('sessionKey').ToString();
	        		
	        		var lastin = sessionkey.LastIndexOf('"');        		
	        		sessionkey = sessionkey.Substring(1, lastin-1);
	               		
	        		PlayerPrefs.SetString("sessionKey", sessionkey);					//Stores the session key in PlayerPrefs (See http://docs.unity3d.com/Documentation/ScriptReference/PlayerPrefs.html)
	        		connected = true;													//Change connected so we won't try to connect again if the sessionkey was already generated
	        		//Debug.Log('DBConnector.EstablishConnection() -> sessionkey: ' + sessionkey);
	        	}
				if(debugMode) Debug.Log("DBConnector.EstablishConnection() -> Text returned by " + url+ "/start/"+session + ": \n" + www.text);
				if(debugMode) Debug.Log('DBConnector.EstablishConnection() -> Text returned by the JSONObject (after Parsing and Stringifying it):\n' + resJSON.ToString());
			}
			else{
				Debug.Log('DBConnector.EstablishConnection() -> The www response was received, but did not have \'text\' field.');
			}
		}

		
	}

	/**
	*	myTracks: Note that this is a built-in .NET array (more info -> http://docs.unity3d.com/Documentation/ScriptReference/Array.html) and 
	*		must be built this way: var myArray : JSONObject[] = new JSONObject[10]; //being 10 the size of the array.
	*	
	*/
	public function Track (myTracks: JSONObject[]){
		
		if(PlayerPrefs.HasKey("sessionKey")){
			
			if(debugMode) Debug.Log('DBConnector.Track() -> Beginning connection with ' + url + '/track with this sessionKey: ' + PlayerPrefs.GetString("sessionKey"));
			
			var myConnection: Connection = new Connection(url, myTracks);		//This will create a new Connection object, which will post the track on the database.
			//myConnection.TrackTraces();
			
			if(debugMode) Debug.Log('DBConnector.Track() -> A new Connection object has been created. ');
			
//		/*   Setting the headers of the http post request...   */
//			var headers = new Hashtable();
//			headers.Add("Authorization", PlayerPrefs.GetString("sessionKey"));
//			headers.Add("Content-type", "application/json");
//			
//		/*   Building the string to send ---> [track1, track2, ..., trackn]   */
//			var stringToSend: String; // = '[' + myTrack.ToString() + ']'
//			var first: boolean = true; 
//			
//			//ISO 8601 date format example: 1994-11-05T13:15:30.503Z (Z is to designate UTC Hour and T is to separate the time and the date) 
//			var theTime = System.DateTime.UtcNow.ToString("hh:mm:ss.fff");
//			var theDate = System.DateTime.UtcNow.ToString("yyy-MM-dd");
//			var mydate : String = theDate + 'T' + theTime + 'Z';
//			if(debugMode) Debug.Log('Date --> '+ mydate);
//			
//			for (var track: JSONObject in myTracks){
//				//Adding timestamp to the package...
//				track.Add("timestamp", mydate);
//
//				if (!first) 
//					stringToSend = stringToSend + ',' + track.ToString();
//				else{
//					first = false;
//					stringToSend = track.ToString();
//				}	
//			}
//			stringToSend = '[' + stringToSend + ']';
//			
//		/*   to convert the string to byte[], that is what WWW() function needs as data (second argument).   */
//			var encoding = new System.Text.UTF8Encoding();
//			var dataToSend = encoding.GetBytes(stringToSend);		
//			
//			//Debug.Log('DBConnector.Track() -> this is the header: ' + headers.ToString());
//			
//			if(debugMode) Debug.Log('DBConnector.Track() -> This is the string to send: ' + stringToSend);
//			
//		/*   Sending the http post   */
//			var www = new WWW(url + "/track", dataToSend, headers);
//			yield www;
//			
//			if(debugMode) Debug.Log("DBConnector.Track() -> Finished yielding the http request.");
//		/*   Dealing with the response   */
//			if (!String.IsNullOrEmpty(www.error))
//		        Debug.Log('DBConnector.Track() -> ' + www.error);
//		    else{
//		    	if(debugMode) Debug.Log('DBConnector.Track() -> Response processed without errors.\nHeaders: ' + www.responseHeaders.ToString());
//		    }
		}
		else{
			Debug.Log('DBConnector.Track() -> sessionKey not found on the game!\nTry connecting to the server again.');
		}

	}
	
}	//End of class brace

public class Connection{
	
	private var debugMode = true;			//if true, a lot of information will be displayed in the console about the progress of the instructions
	
	private var url: String;
	private var myTracks: JSONObject[];
	
	public function Connection(url: String, myTracks: JSONObject[]){	//The track function is used because we can not yield inside a constructor
		Debug.Log("Connection.Connection() --> Connection object created");
		this.url = url;
		this.myTracks = myTracks;
			
		/*   Setting the headers of the http post request...   */
			var headers = new Hashtable();
			headers.Add("Authorization", PlayerPrefs.GetString("sessionKey"));
			headers.Add("Content-type", "application/json");
			
		/*   Building the string to send ---> [track1, track2, ..., trackn]   */
			var stringToSend: String; // = '[' + myTrack.ToString() + ']'
			var first: boolean = true; 
			
			//ISO 8601 date format example: 1994-11-05T13:15:30.503Z (Z is to designate UTC Hour and T is to separate the time and the date) 
			var theTime = System.DateTime.UtcNow.ToString("hh:mm:ss.fff");
			var theDate = System.DateTime.UtcNow.ToString("yyy-MM-dd");
			var mydate : String = theDate + 'T' + theTime + 'Z';
			if(debugMode) Debug.Log('Connection.Connection() --> Date --> '+ mydate);
			
			for (var track: JSONObject in myTracks){
				//Adding timestamp to the package...
				track.Add("timestamp", mydate);

				if (!first) 
					stringToSend = stringToSend + ',' + track.ToString();
				else{
					first = false;
					stringToSend = track.ToString();
				}	
			}
			stringToSend = '[' + stringToSend + ']';
			
		/*   to convert the string to byte[], that is what WWW() function needs as data (second argument).   */
			var encoding = new System.Text.UTF8Encoding();
			var dataToSend = encoding.GetBytes(stringToSend);		
			
			//Debug.Log('DBConnector.Track() -> this is the header: ' + headers.ToString());
			
			if(debugMode) Debug.Log('Connection.Connection() --> This is the string to send: ' + stringToSend);
			
		/*   Sending the http post   */
			var www = new WWW(url + "/track", dataToSend, headers);
			//yield www;
			while(!www.isDone); //Debug.Log("Progress: " + www.progress);  //You can't yield on a constructor. This is the alternative. This way blocks the execution
			
			if(debugMode) Debug.Log("Connection.Connection() --> Finished waiting the http request.");
		/*   Dealing with the response   */
			if (!String.IsNullOrEmpty(www.error))
		        Debug.Log('DBConnector.Track() -> ' + www.error);
		    else{
		    	if(debugMode) Debug.Log('Connection.Connection() --> Response processed without errors.\nHeaders: ' + www.responseHeaders.ToString());
		    }
	}
	
	public function TrackTraces(){
	
			
	}
}