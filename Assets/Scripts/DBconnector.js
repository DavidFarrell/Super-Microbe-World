#pragma strict

//Imports
import Boomlagoon.JSON;
//import UnityEngine;

//var port: int;

public class DBconnector extends MonoBehaviour{
	
	//private var url: String = "http://localhost:3030";		//adress and port of the database server	//This is to connect to the local server
	
	private var url: String = "http://supermicrobeworld.herokuapp.com";						//To connect to the remote server

	private var sessionkey: String = 'empty';
	
	public var timelimit: int = 15;				//Max time in seconds that the connection will have to be finished. 

	@HideInInspector
	var connected: boolean = false;			//This variable should be checked after connecting with 
	
	private var debugMode = true;			//if true, a lot of information will be displayed in the console about the progress of the instructions
	
	private var gameLogic: GameLogic;
	
	private var online: boolean; 		//This variable will be true if the GameLogic script says so.
	
	private var Connections: ConnectionQueue;
	private var MaxConnections: int = 10;		//Maximum number of connections that will be held concurrently
	
	public function Start(){
		gameLogic = transform.gameObject.GetComponent("GameLogic");
		online = gameLogic.checkOnLine();
		Connections = new ConnectionQueue(MaxConnections);
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
		
		/*Creating the heades for the http POST request*/	//Changed the GET request by a POST request as the GET request can't have custom headers in the webplayer build.
		var headers = new Hashtable();
		headers.Add("Authorization", userID);
		
		/*Sending the request*/
		if(debugMode) Debug.Log('DBConnector.ConnectToGleaner() -> Beginning connection...');
		//the second argument is the data sent with the POST request. This element is not used in the server side, but is necessary as this way the request will be a POST and not a GET
		var encoding = new System.Text.UTF8Encoding();
		var www = new WWW(url + "/start/"+session, encoding.GetBytes("empty"), headers);
		Debug.Log(url + "/start/"+session);
		yield www;
		
		/*Dealing with the response*/
		if (!String.IsNullOrEmpty(www.error)){
	        Debug.LogError('DBConnector.ConnectToGleaner() -> Error in the http response' + www.error);
	    }
	    else{
	    	if (www.text){
	        	var resJSON : JSONObject = JSONObject.Parse(www.text);					//resJSON should contain the parsed JSON if there hasn't been errors
	        	if(debugMode) Debug.Log('DBConnector.ConnectToGleaner() -> Connection established');
	        	if (resJSON.ContainsKey('sessionKey')){
	        		
	        		sessionkey = resJSON.GetValue('sessionKey').ToString();
	        		
	        		var lastin = sessionkey.LastIndexOf('"');        		
	        		sessionkey = sessionkey.Substring(1, lastin-1);
	               		
	        		PlayerPrefs.SetString("sessionKey", sessionkey);					//Stores the session key in PlayerPrefs (See http://docs.unity3d.com/Documentation/ScriptReference/PlayerPrefs.html)
	        		connected = true;													//Change connected so we won't try to connect again if the sessionkey was already generated
	        		//Debug.Log('DBConnector.EstablishConnection() -> sessionkey: ' + sessionkey);
	        	}
				if(debugMode) Debug.Log("DBConnector.ConnectToGleaner() -> Text returned by " + url+ "/start/"+session + ": \n" + www.text);
				if(debugMode) Debug.Log('DBConnector.ConnectToGleaner() -> Text returned by the JSONObject (after Parsing and Stringifying it):\n' + resJSON.ToString());
			}
			else{
				Debug.LogError('DBConnector.ConnectToGleaner() -> The www response was received, but did not have \'text\' field.');
			}
		}

		
	}
	
//	public function ConnectToGleaner (userID: String, session: String){//: Object{
//		Debug.Log("Beginning the connection to the DB");
//		
//		
//		
//		if (PlayerPrefs.HasKey("sessionKey")) PlayerPrefs.DeleteKey("sessionKey");		//just to make sure
//		
//		/*Creating the heades for the http get request*/
//		var headers = new Hashtable();
//		headers.Add("Authorization", userID);
//		
//		/*Sending the request*/
//		if(debugMode) Debug.Log('DBConnector.ConnectToGleaner() -> Beginning connection...');
//		var www = new WWW(url + "/start/"+session, null, headers);
//		yield www;
//		
//		/*Dealing with the response*/
//		if (!String.IsNullOrEmpty(www.error)){
//	        Debug.LogError('DBConnector.ConnectToGleaner() -> Error in the http response' + www.error);
//	    }
//	    else{
//	    	if (www.text){
//	        	var resJSON : JSONObject = JSONObject.Parse(www.text);					//resJSON should contain the parsed JSON if there hasn't been errors
//	        	if(debugMode) Debug.LogError('DBConnector.ConnectToGleaner() -> Connection established');
//	        	if (resJSON.ContainsKey('sessionKey')){
//	        		
//	        		sessionkey = resJSON.GetValue('sessionKey').ToString();
//	        		
//	        		var lastin = sessionkey.LastIndexOf('"');        		
//	        		sessionkey = sessionkey.Substring(1, lastin-1);
//	               		
//	        		PlayerPrefs.SetString("sessionKey", sessionkey);					//Stores the session key in PlayerPrefs (See http://docs.unity3d.com/Documentation/ScriptReference/PlayerPrefs.html)
//	        		connected = true;													//Change connected so we won't try to connect again if the sessionkey was already generated
//	        		//Debug.Log('DBConnector.EstablishConnection() -> sessionkey: ' + sessionkey);
//	        	}
//				if(debugMode) Debug.Log("DBConnector.ConnectToGleaner() -> Text returned by " + url+ "/start/"+session + ": \n" + www.text);
//				if(debugMode) Debug.Log('DBConnector.ConnectToGleaner() -> Text returned by the JSONObject (after Parsing and Stringifying it):\n' + resJSON.ToString());
//			}
//			else{
//				Debug.LogError('DBConnector.ConnectToGleaner() -> The www response was received, but did not have \'text\' field.');
//			}
//		}
//
//		
//	}

	/**
	*	myTracks: Note that this is a built-in .NET array (more info -> http://docs.unity3d.com/Documentation/ScriptReference/Array.html) and 
	*		must be built this way: var myArray : JSONObject[] = new JSONObject[10]; //being 10 the size of the array.
	*	
	*/
	public function Track (myTracks: JSONObject[]){
		
		if(PlayerPrefs.HasKey("sessionKey")){
			
			if(debugMode) Debug.Log('DBConnector.Track() -> Beginning connection with ' + url + '/track with this sessionKey: ' + PlayerPrefs.GetString("sessionKey"));
			
			Connections.Add(new Connection(url, myTracks, timelimit));		//This will create a new Connection object, which will post the track on the database. This connection object will be added to a queue.
			//var myConnection: Connection = new Connection(url, myTracks);		
			//myConnection.TrackTraces();
			
			if(debugMode) Debug.Log('DBConnector.Track() -> A new Connection object has been created. ');
			
		}
		else{
			Debug.Log('DBConnector.Track() -> sessionKey not found on the game!\nTry connecting to the server again.');
		}

	}
	
	//This function is finally not needed if the game is being played from the server, because just asking the server for the page where the game will be loaded (and after that for the game itself) wakes the server
	
//	public function AwakeServer(){
//		//The server is hosted at heroku. When the server doesn't receive any request for an hour it goes to idle state, which takes 5 seconds or so to get into the awake state again.
//		//This is why we call this function, to awake the server before we have to do the first petition asking for the sessionkey.
//		
//		if (url == "http://supermicrobeworld.herokuapp.com"){
//			/*if(debugMode)*/ Debug.Log("Waking up the server...");
//			var www = new WWW(url + "/unknownpage");	//At this time, the url gets an error if the main page is asked...
//			yield www;
//		}
//	}
	
}	//End of DBconnector class brace

public class Connection{// extends System.Object{
	//This class will post a trace in the database. 
	//Creates a "Coroutiner" GameObject per connection, so if we want to make many connections this would't be the best solution... Is the only way I've found to call a coroutine from the constructor of a class not inheriting from MonoBehaviour so far. 
	//Not suitable to make many connections per second for the reason explained in the line above.
		
	private var debugMode = false;			//if true, a lot of information will be displayed in the console about the progress of the instructions
	
	private var url: String;
	private var myTracks: JSONObject[];
	
	public var coroutineRunner : Coroutiner = null;			//We can't run coroutines in classes that doesn't inherit from MonoBehaviour. So this is the solution, explained in the answers of this forum http://answers.unity3d.com/questions/452773/how-to-use-yield-within-a-class-function.html 
	
	public function Connection(url: String, myTracks: JSONObject[], timelimit: int){	
		//The "TrackTraces" function is used because we can not yield inside a constructor
		//Url: The url to make the http connection
		//myTracks: a built in .net array containing JSONObjects with the tracks to post
		//timelimit: the maximum time that the connection will have to be finnished
		
		if (coroutineRunner == null )
	    {
            var go = new GameObject("Coroutiner");
            DontDestroyOnLoad(go);
            Destroy (go, timelimit);			// Kills the game object "go" in "timelimit" seconds after loading the object
            coroutineRunner = go.AddComponent(Coroutiner);      
		}
		
		if(debugMode) Debug.Log("Connection.Connection() --> Connection object created");
		this.url = url;
		this.myTracks = myTracks;
		
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
		
		coroutineRunner.StartCoroutine(TrackTraces(stringToSend));	//Starts the coroutine
	}
	
	public function TrackTraces(stringToSend: String){
		
	/*   Setting the headers of the http post request...   */
		var headers = new Hashtable();
		headers.Add("Authorization", PlayerPrefs.GetString("sessionKey"));
		headers.Add("Content-type", "application/json");
		
	/*   to convert the string to byte[], that is what WWW() function needs as data (second argument).   */
		var encoding = new System.Text.UTF8Encoding();
		var dataToSend = encoding.GetBytes(stringToSend);		
		
		//Debug.Log('DBConnector.Track() -> this is the header: ' + headers.ToString());
		
		Debug.Log('Connection.Connection() --> This is the string to send: ' + stringToSend);
		
	/*   Sending the http post   */
		var www = new WWW(url + "/track", dataToSend, headers);
		yield www;
		//while(!www.isDone); //Debug.Log("Progress: " + www.progress);  //You can't yield on a constructor. This is the alternative. This way blocks the execution
		
		if(debugMode) Debug.Log("Connection.Connection() --> Finished waiting the http request.");
	/*   Dealing with the response   */
		if (!String.IsNullOrEmpty(www.error)){
	        Debug.LogError('DBConnector.Track() ERROR -> ' + www.error);
	    }
	    else{
	    	/*if(debugMode) */Debug.Log('Connection.Connection() --> Response processed without errors.\nHeaders: ' + www.responseHeaders.ToString());
	    }
	}
	
} //End of Connection class

	private class ConnectionQueue{
		/*
		This class is a queue of connection objects. Its purpose is to keep a pointer to every connection object created so it can wait for the connectioon to finish. 
		There was a problem whith the connection class being called from the Track function of the DBConnector class. The problem was that when we were trying to make two connections very close in time between them, the second connection overwrote the first one, and the first connection object was destroyed by the garbage collector, not letting the http request to end properly.
		*/
		//Note that MaxConnections must be a number big enough, because in this queue we won't push any conection out of the queue, but the oldest connection will be overwritten if there are not free possitions in the array. 
		private var Queue: Connection[];
		private var position: int = 0; //Points to the 
		private var MaxConnections: int;
		
		public function ConnectionQueue(MaxConnections: int){
			Queue = new Connection[MaxConnections];
			this.MaxConnections = MaxConnections;
		}
		
		public function Add(con: Connection){
			Queue[position] = con;
			position++;
			if (position == MaxConnections){
				position = 0;
			}
		}
		
	}