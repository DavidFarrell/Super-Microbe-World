#pragma strict

public class LevelLogicFinal extends MonoBehaviour{

	private var gameHost : GameObject;
	private var playerAmy : GameObject;
	private var playerHarry : GameObject;
	
	private var playerName : String;		//The name of the player in use will be loaded in the beginning
	
	private var amyAnim : Animator;
	private var harryAnim : Animator;
	private var hostAnim : Animator;
	
	private var playerAnim : Animator;
	private var opponentAnim : Animator;
	
	private var amyScoreBoard : ScoreBoard;
	private var harryScoreBoard : ScoreBoard;
	
	private var playerScoreBoard : ScoreBoard;			//To update the animations of the chosen player
	private var opponentScoreBoard : ScoreBoard;		//and the opponent
	
	private var textBoxGO : GameObject;
	private var textBox : TextBox;			//To have a reference to the TextBox class in order to use its functions
	
	private var gameLogic : GameLogic;
	
	private var levelStarted: boolean = false;		//This boolean is used to launch just once the sequencial part of the level from the Update() method
	
	private var debugMode = true;

	function Awake () {
		gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
		
		//Save the references to the game objects of amy, hrry and the host
		playerAmy = GameObject.Find("amy");
		playerHarry = GameObject.Find("harry");
		gameHost = GameObject.Find("gamehost");
		
		if (!gameHost) Debug.Log("Game host hasn't been found!");
		
		textBoxGO = GameObject.Find("TextBox");						//Keep a reference to the GameObject Text Box
		
		if (PlayerPrefs.HasKey("player"))							//We'll set amy or harry as player depending on which one was selected in the initial scene.
			playerName = PlayerPrefs.GetString("player");
		else{
			Debug.LogError("'player' attribute not found in the PlayerPrefs. Using harry as default.");
			playerName = "harry";
		}
	}

	function Start () {
		
		//Load the animators
		amyAnim = playerAmy.GetComponent(Animator);
		harryAnim = playerHarry.GetComponent(Animator);
		hostAnim = gameHost.GetComponent(Animator);
		if (!hostAnim) Debug.Log("Game host's animation hasn't been found!");
		
		//Save the references to the ScoreBoard.js scripts attached to Amy and Harry.
		amyScoreBoard = playerAmy.transform.GetComponent("ScoreBoard");
		harryScoreBoard = playerHarry.transform.GetComponent("ScoreBoard");
		
		if(playerName == "harry"){					//this will be neccesary to update the scoreboards
			playerScoreBoard = harryScoreBoard;
			opponentScoreBoard = amyScoreBoard;
			playerAnim = harryAnim;
			opponentAnim = amyAnim;
		}else{
			playerScoreBoard = amyScoreBoard;
			opponentScoreBoard = harryScoreBoard;
			playerAnim = amyAnim;
			opponentAnim = harryAnim;
		}
		
		textBox = textBoxGO.GetComponent(TextBox);			//To have a reference to the TextBox class in order to use it
		
		SendInfoToDB();
		
	}

	function Update () {
		if (!levelStarted){					//Operations to perform the first time that this function is used, on the first frame
			levelStarted = true;
			
			playerScoreBoard.SetPoints(PlayerPrefs.GetInt("PlayerScore"));
			opponentScoreBoard.SetPoints(PlayerPrefs.GetInt("OpponentScore"));
			//Debug.Log("Starting quiz. Player and opponent scores were: " + PlayerPrefs.GetInt("PlayerScore") + " and " + PlayerPrefs.GetInt("OpponentScore") + " respectively in the last quiz level.");
			
			StartLevel();
		}
		
	}
	
	function StartLevel(){
		hostAnim.SetTrigger("serious");
		playerAnim.SetTrigger("idle");
		opponentAnim.SetTrigger("idle");
		amyScoreBoard.Disable();
		harryScoreBoard.Disable();
		
		yield textBox.SayThis("Game host", "It looks that you have completed the game.");
		yield textBox.SayThis("Game host", "Now it's time to take a look to the scoreboards and see who is the winner!");
		yield textBox.SayThis("Game host", "Are you ready? Let's go!");
		
		amyScoreBoard.Enable();
		harryScoreBoard.Enable();
		
		yield new WaitForSeconds(1);
		
		if (playerScoreBoard.GetPoints() > opponentScoreBoard.GetPoints()){		//player wins
			hostAnim.SetTrigger("excited");
			playerAnim.SetTrigger("happy");
			opponentAnim.SetTrigger("disappointed");
			yield textBox.SayThis("Game host", "Congratulations "+ playerName +"! You win the contest!!.");
		}
		else{
			if(playerScoreBoard.GetPoints() < opponentScoreBoard.GetPoints()){ 																	//player loses
				hostAnim.SetTrigger("excited");
				playerAnim.SetTrigger("disappointed");
				opponentAnim.SetTrigger("happy");
				yield textBox.SayThis("Game host", "Your opponent wins the game! Well done both. Play again for a chance to defeat your opponent.");
			}
			else{																											//Draw
				hostAnim.SetTrigger("excited");
				playerAnim.SetTrigger("happy");
				opponentAnim.SetTrigger("happy");
				yield textBox.SayThis("Game host", "We have a draw!! Well done both! Play again for another chance to win!");
			}
		}
		
		yield new WaitForSeconds(2);
		
		hostAnim.SetTrigger("stop");
		
		
		
		while(true){
			yield new WaitForSeconds(15);
			yield textBox.SayThis("Game host", "Reload the page to play again!");
			
			yield new WaitForSeconds(15);
			yield textBox.SayThis("Game host", "This game was programmed by Pedro Rodriguez Diaz, with the help of David Farrell.");
			
			yield new WaitForSeconds(15);
			yield textBox.SayThis("Game host", "Hope you had fun with it :)");
		}
		
		//gameLogic.NextLevel();			//Uncomment this line if the game is not a web build to close the game
		
	}
	
	private function SendInfoToDB(){
		//yield new WaitForSeconds(2);		//To wait just in case that the previous level is sending information.
		if (gameLogic.checkConnection()){			//If we are authenticated in the web service
			var firstTrack: JSONObject = new JSONObject();	//Sending the track to the database..
			firstTrack.Add("type", "logic");
			//firstTrack.Add("event", "Loading quiz level number " + CurrentRoundNum);
			
			if (playerScoreBoard.GetPoints() > opponentScoreBoard.GetPoints()){		//player wins
				firstTrack.Add("event", "Game finished. Player wins the game");
			}
			else{
				if(playerScoreBoard.GetPoints() < opponentScoreBoard.GetPoints()){ 																	//player loses
					firstTrack.Add("event", "Game finished. Player loses the game");
				}
				else{																											//Draw
					firstTrack.Add("event", "Game finished. There was a draw.");
				}
			}
			firstTrack.Add("scores", playerScoreBoard.GetPoints() + "," + opponentScoreBoard.GetPoints());
			
			var tracks : JSONObject[] = new JSONObject[1];
			if (!firstTrack || ! tracks) Debug.LogError("Unable to create JSONObject or array");
			tracks[0] = firstTrack;
			if (gameLogic.db) gameLogic.db.Track(tracks);
		}
		else{
			Debug.Log("Connection not established (sessionKey not found) when trying to post the first trace.");
		}
	}
	
}