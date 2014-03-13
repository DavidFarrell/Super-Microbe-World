#pragma strict

import System.Collections.Generic;

public class LevelLogicQuiz extends MonoBehaviour{
	
	/*This script is almost identical to the LevelLogicGameShow.js script. It's used to control the logic of the quiz scenes.*/
	
	//TODO this script always loads the xml format string of the var below this comment. We'll have to change it to ask for the xml text using an http petition to the server with the WWW class of unity script and getting this information from the WWW.text field
	
	//private var TextFromXML: String = '<?xml version="1.0" encoding="utf-8" ?><round id="0">	<name>All About Microbes</name>	<round_id>0</round_id>	<next_round>alpha_gameshow_round2.xml</next_round>	<intro_text>		<blind>			<statement>Welcome to the first BLIND QUESTION ROUND!</statement>			<statement>I"m going to ask you some questions but I"m NOT going to tell you if you got them right!</statement>			<statement>If you got them right, you"ll get a great bonus later though so try your best.</statement>			<statment>Lets go!</statment>		</blind>		<normal>			<statement>Well done, you"re a hoverboard natural!</statement>			<statement>Now it"s time to ask you those questions again</statement>			<statement>This time, you get 10 points for a correct answer, but if you get it wrong, the other player gets points.</statement>			<statement>so if you DON"T KNOW the answer, it"s best to play it safe and say so!</statement>			<statement>Ready?</statement>			<statement>Let"s go!</statement>		</normal>	</intro_text>	<questions>		<question id="0">			<type>0</type>			<score>10</score>			<value>1</value>			<text>If you cannot see a microbe it is not there</text>			<answers>				<answer>					<label>Agree</label>					<value>-1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>1</value>				</answer>			</answers>		</question>		<question id="1">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Bacteria and Viruses are the same</text>			<answers>				<answer>					<label>Agree</label>					<value>-1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>1</value>				</answer>			</answers>		</question>		<question id="2">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Fungi are microbes</text>			<answers>				<answer>					<label>Agree</label>					<value>1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>-1</value>				</answer>			</answers>		</question>		<question id="3">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Microbes are found on our hands</text>			<answers>				<answer>					<label>Agree</label>					<value>1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>-1</value>				</answer>			</answers>		</question>	</questions></round>';
	
	//public var errorMessage: GUIText;		//Points to a prefab placed in Assets/Prefabs/LogicManagement. Is a GUIText to show error messages in the built versions.
	
	private var CurrentRound : Round;		//Will point to a Round object containing the parsed data from the xml string above
	private var roundH : RoundHandler;		//This is the object that will be used as a handler to get the round object from the web or local.
	
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
	
	public var formBackground : GameObject;				//Here must be dragged the prefab of the background of the questions. The blue screen acts as background when the player is given to choose among the three options.
	
	private var textBoxGO : GameObject;
	private var textBox : TextBox;			//To have a reference to the TextBox class in order to use its functions
	
	private var gameLogic : GameLogic;
	
	private var levelStarted: boolean = false;		//This boolean is used to launch just once the sequencial part of the level from the Update() method
	
	private var blindMode: boolean = false;	//This boolean is to choose whether the game is going to be played on normal mode (false) or blind mode (true)
	private var debugMode = true;
	
	private var CurrentRoundNum: int;				//stores the number of the current round of questions
	private var TotalQuestions: int;				//stores the amount of questions that the current round has
	private var CurrentQuestionNum: int = 0;		//stores the number of the current question
	private var CurrentQuestion: Question;			//Stores the current question
	private var answers: List.<int>;			//This list will store on each component 1 if it was answered correctly by the player and -1 if it was failed. 0 will be stored if the player didn't know.
	
	private var formMode: boolean = false;			//Used to display or not the part of the GUI used to ask the questions. 
	
	public var textStyle : GUIStyle;		//Style of the GUI of the form
	public var buttonStyle : GUIStyle;		//Style of the buttons of the form
	
	//private var NextQuestion: int = ;
	
	function Awake () {
		
		gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
		
		CurrentRoundNum = gameLogic.GetRoundNumber();							//Will get from the GameLogic script the number of quiz level that the player have to play now. 
		if (debugMode) Debug.Log("Awake function of the LevelLogicQuiz.js. Round number is: " + CurrentRoundNum);
		
		/*if (!CurrentRound){
			errorMessage.text = "ERROR! There was an error when trying to load the xml file...\nThe CurrentRound object in LevelLogicQuiz class is null.";
			errorMessage.enabled = true;
		}*/
		
		//Save the references to the game objects of amy, hrry and the host
		playerAmy = GameObject.Find("amy");
		playerHarry = GameObject.Find("harry");
		gameHost = GameObject.Find("gamehost");
		
		if (!gameHost) Debug.Log("Game host hasn't been found!");
		
		//formBackground = GameObject.Find("FormBackground");
		formBackground = Instantiate(formBackground);
		
		textBoxGO = GameObject.Find("TextBox");						//Keep a reference to the GameObject Text Box
		
		answers = new List.<int>();			//To initialize the answers array
		
		if (PlayerPrefs.HasKey("player"))							//We'll set amy or harry as player depending on which one was selected in the initial scene.
			playerName = PlayerPrefs.GetString("player");
		else{
			Debug.LogError("'player' attribute not found in the PlayerPrefs. Using Harry as default.");
			playerName = "harry";
		}
		
		//errorMessage = Instantiate(errorMessage);
		//errorMessage.enabled = false;
		
	}
	
	function Start () {
		
		if (debugMode) Debug.Log("Start function of the LevelLogicQuiz.js.");
		
		//gameLogic.GetQuestions();								//Here we ask for the "Round" object from the GameLogic class. 
		
		//As it may take a while to be served when we are asking for it to the web server, we won't be waiting it. 
		//When the round object has been created, the function ReceiveRound() will be executed. This object (Round) contains the questions and answers to be asked to the players. 
		//See Round class for more information
		
		formBackground.SetActive(false);							//Disable the form background, which will be enabled when needed
		
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
		
		SendInitInfoToDB();		//To say the DB that the level has been loaded
		
		textBox = textBoxGO.GetComponent(TextBox);			//To have a reference to the TextBox class in order to use it
		
	}

	function Update () {
		
		if (!levelStarted){					//Operations to perform the first time that this function is used, on the first frame
			levelStarted = true;
			
			playerScoreBoard.SetPoints(PlayerPrefs.GetInt("PlayerScore"));
			opponentScoreBoard.SetPoints(PlayerPrefs.GetInt("OpponentScore"));
			//Debug.Log("Starting quiz. Player and opponent scores were: " + PlayerPrefs.GetInt("PlayerScore") + " and " + PlayerPrefs.GetInt("OpponentScore") + " respectively in the last quiz level.");
			
			//StartLevel();
			CurrentRound = GetQuestions();
			StartShowingQuestions(CurrentRound);
		}
		
	}
	
	function OnGUI () {
		
		if (formMode){		//This part of the gui will only execute when the game is in the part that the player need to answer some question.
			
			GUI.Label (Rect (Screen.width*0.1, Screen.height*0.1, Screen.width*0.3, Screen.height*0.1), "Question number " + CurrentQuestionNum, textStyle);
			GUI.Label (Rect (Screen.width*0.1, Screen.height*0.13, Screen.width*0.3, Screen.height*0.1), CurrentQuestion.text, textStyle);
			GUI.Label (Rect (Screen.width*0.7, Screen.height*0.1, Screen.width*0.3, Screen.height*0.1), "10 points", textStyle);
			
			
			if (GUI.Button (Rect (Screen.width*0.4, Screen.height*0.35, Screen.width*0.2, Screen.height*0.1), GUIContent ("Agree", "Click here if you agree with the statement"), buttonStyle)){
				Answer("Agree");
				
			}
			if (GUI.Button (Rect (Screen.width*0.4, Screen.height*0.50, Screen.width*0.2, Screen.height*0.1), GUIContent ("Don't Know", "Click here if you agree with the statement"), buttonStyle)){
				Answer("Don't Know");
			}
			if (GUI.Button (Rect (Screen.width*0.4, Screen.height*0.65, Screen.width*0.2, Screen.height*0.1), GUIContent ("Disagree", "Click here if you agree with the statement"), buttonStyle)){
				Answer("Disagree");
			}
			
		}
		
	}
	
	private function SendInitInfoToDB(){
		//yield new WaitForSeconds(2);		//To wait just in case that the previous level is sending information.
		if (gameLogic.checkConnection()){			//If we are authenticated in the web service
			var firstTrack: JSONObject = new JSONObject();	//Sending the track to the database..
			firstTrack.Add("type", "logic");
			firstTrack.Add("event", "Loading quiz level number " + CurrentRoundNum);
			firstTrack.Add("round", CurrentRoundNum.ToString());
			var tracks : JSONObject[] = new JSONObject[1];
			if (!firstTrack || ! tracks) Debug.LogError("Unable to create JSONObject or array");
			tracks[0] = firstTrack;
			if (gameLogic.db) gameLogic.db.Track(tracks);
		}
		else{
			Debug.Log("Connection not established (sessionKey not found) when trying to post the first trace.");
		}
	}
	
//	function TestXmlSerializer(){
//	//This function is to TEST if the xml serializer works.
//		
//		Debug.Log("Starting to parse the xml...");
//		
//		//CurrentRound = new Round();
//		CurrentRound = Round.LoadFromText(TextFromXML);
//		
//		Debug.Log("Parsed.");
//		
//		Debug.Log("Round id: " + CurrentRound.id);
//		Debug.Log("Name: " + CurrentRound.name);
//		Debug.Log("Round Id: " + CurrentRound.round_id);
//		Debug.Log("Next Round: " + CurrentRound.next_round);
//		
//		var blindStatements: String = "";
//		for(var blindStatement: String in CurrentRound.intro_text.blind){
//			blindStatements = blindStatements + "\n" + blindStatement;
//		}
//		Debug.Log("Intro text (blind statements): " + blindStatements);
//		
//		var normalStatements: String = "";
//		for(var normalStatement: String in CurrentRound.intro_text.normal){
//			normalStatements = normalStatements + "\n" + normalStatement;
//		}
//		Debug.Log("Intro text: (normal statements)" + normalStatements);
//		//Debug.Log("Questions: " + CurrentRound.name);
//	}
	
		public function GetQuestions() : Round{
		//This class begins the process of getting the round object containing the questions and answers
		
		//if (debugMode) Debug.Log("*************LevelLogicQuiz: Executing GetQuestions() method.");
		
		roundH = new RoundHandler();
		
//		if (gameLogic.checkOnLine() && gameLogic.checkConnection()){
//			roundH.LoadRoundFromWeb(gameLogic.GetRoundNumber());			//requesting the dialogue from a server
//		}else{
//			roundH.LoadRoundFromXMLResources(gameLogic.GetRoundNumber());	//reading the dialogues locally
//		}
		CurrentRoundNum = gameLogic.GetRoundNumber();
		if (CurrentRoundNum > 0 && CurrentRoundNum < 6){
			switch(CurrentRoundNum){
				case 1:
					return roundH.LoadFromText(en_en_gameshow_round1.GetRoundText());
				case 2:
					return roundH.LoadFromText(en_en_gameshow_round2.GetRoundText());
				case 3:
					return roundH.LoadFromText(en_en_gameshow_round3.GetRoundText());
				case 4:
					return roundH.LoadFromText(en_en_gameshow_round4.GetRoundText());
				case 5:
					return roundH.LoadFromText(en_en_gameshow_round5.GetRoundText());	
			}
		}else{
			Debug.LogError("LevelLogicQuiz: Wrong round number!");
			gameLogic.PrintError("LevelLogicQuiz: Wrong round number.", 3);
			return null;
		}
	}
	
	public function StartShowingQuestions(myRound: Round){
		//This function will execute all the sequence of actions that have to be done during the level
		
		//if (debugMode) Debug.Log("*************LevelLogicQuiz: Executing StartShowingQuestions() method.");
		
		CurrentRound = myRound;
		
		TotalQuestions = CurrentRound.questions.Count;	//To keep the number of questions in this round. NOTE that the CurrentRound object must exist when trying to acccess its question field. Otherwise there will be a null pointer exception
		//Debug.Log("The number of questions is: " + TotalQuestions);
		
		/* These are the actions to perform:
		-Show the textBox with the welcome text
		-Repeat this:
			-Read first question
			-Show the screen to choose the answer (waiting for the player to click any key...)
			-Read your answer, check and inform if it was correct or not
			-Do the same with the other player
		*/
		
		if (debugMode && !hostAnim) Debug.Log("Can't reach HostAnim!!");
		
		hostAnim.SetTrigger("excited");
		
		//blindMode = true;				//blindMode is False by default
		
		if(blindMode){
			yield textBox.SayThis("Game host", CurrentRound.intro_text.blind);
		}else{
			yield textBox.SayThis("Game host", CurrentRound.intro_text.normal);
		}
		
		
		
		//note that "question" is a class name, and quest is a variable
//		for(var quest : Question in CurrentRound.questions){
//			Debug.Log("Question: " + quest.text);
//			yield textBox.SayThis("Game host", quest.text);
//			ShowQuestion();
//		}
		
		CurrentQuestionNum = 0;
		ShowQuestion();
		
	}
	
	private function ShowQuestion(){
		/*This method will display the current question (which number is in the CurrentQuestionNum var) and the options to answer.
		The idea is to call this method every time that we need to show the following question.
		*/
		
		CurrentQuestion = CurrentRound.questions[CurrentQuestionNum];	//To keep the present question
		
		//Debug.Log("Question : " + CurrentQuestion.text);
		
		yield textBox.SayThis("Game host", CurrentQuestion.text);	
		
		amyScoreBoard.Disable();
		harryScoreBoard.Disable();
		formBackground.SetActive(true);
		
		formMode = true;
	}
	
	private function Answer(CurrentAnswer: String){
		//This function is called when some button in the form is pressed. The argument CurrentAnswer contains which button was pressed.
		//It checks if the answer was correct, update the scores, save the answers to be submitted to the database and plays the animations of the characters
		
		//Debug.Log("The user answered " + CurrentAnswer + " to the question number " + CurrentQuestionNum);
		
		amyScoreBoard.Enable();
		harryScoreBoard.Enable();
		formBackground.SetActive(false);
		formMode = false;
	
		//Getting the score of the player for this question
		//The score after the for loop will be 0 if answered Don't know, +10 if clicked on the correct answer, and -10 if answered the wrong answer
		var score: int = CurrentQuestion.score;
		var CurrentAnswerValue : int = 0;
		//Debug.Log("The score of the current question is " + score);
		for(var an: Answer in CurrentQuestion.answers){
//			Debug.Log("**** Q"+ CurrentQuestionNum +"; an.label: " + an.label + " CurrentAnswer: " + CurrentAnswer + " ****");
			if(an.label == CurrentAnswer){				
				CurrentAnswerValue = an.value;
				//Debug.Log("The answer submitted was correctly found amongst the answers of the xml: " + an.label + ". And the value is: " + an.value + " Parsed value: " + CurrentAnswerValue);
			}
		}
		
		//Storing score and updating the scoreboards
		if(CurrentAnswerValue>0){
			answers.Add(1);				//To store the answer
			//Do the gamehost tell the result if not in the blindmode.
			if(!blindMode){	
				playerAnim.SetTrigger("happy");
				yield textBox.SayThis("Game host", "Your answer was: " + CurrentAnswer + "\nThis is the CORRECT answer");
			}
		}else{
			if(CurrentAnswerValue<0){
				answers.Add(-1);	
				if(!blindMode){	
					playerAnim.SetTrigger("disappointed");
					yield textBox.SayThis("Game host", "Your answer was: " + CurrentAnswer + "\nThis is the WRONG answer");
					opponentScoreBoard.ChangePoints(5);			//If the player fails its answer, the opponent will get an extra 5 points!
				}
			}else{	//score == 0
				answers.Add(0);		
				if(!blindMode){	
					yield textBox.SayThis("Game host", "You chose the safe answer");	
				}
			}
		}
		
		score = CurrentQuestion.score * CurrentAnswerValue;
		//Debug.Log("score obtained: " + score + " Score for this question if answered correctly: " + CurrentQuestion.score + " Value of current answer: " + CurrentAnswerValue);
		
		if (score < 0){						//score<0 means that the player chose the wrong answer, so we add 0 points to the player and add 5 points to the opponent.
			score = 0;
		}
		if(!blindMode){	
			playerScoreBoard.ChangePoints(score);			//To update the scoreboard of the player (score will be added to the old score)
		}
		
		if(!blindMode){	
			//Generating the answer of the other player
			var rndNum: int = Random.Range(0, 3);	//Will generate numbers between 0 and 2 (0 means that the opponent fail the question, 1, that he doesn't know and 2 that he answered the question correctly)
			switch(rndNum){
				case 0:		//opponent fails
					playerScoreBoard.ChangePoints(5);
					opponentAnim.SetTrigger("disappointed");
					yield textBox.SayThis("Game host", "Your opponent's answer was WRONG");
					break;
				case 1:		//opponent doesn't know
					yield textBox.SayThis("Game host", "Your opponent chose the safe answer");
					break;
				case 2:		//opponent answers correctly
					opponentScoreBoard.ChangePoints(CurrentQuestion.score);
					opponentAnim.SetTrigger("happy");
					yield textBox.SayThis("Game host", "Your opponent's answer was CORRECT");
					break;
			}
		}
		CurrentQuestionNum++;
		playerAnim.SetTrigger("idle");
		opponentAnim.SetTrigger("idle");
		if (CurrentQuestionNum == TotalQuestions){		//There's not any more questions in this round
			SubmitResults();								//To submit the score to the database
			Debug.Log("This was the last question. Now we'll change the level.");
			gameLogic.NextLevel();
		}
		else{									//Shows the next question
			//Debug.Log("Going for the next question, question number " + CurrentQuestionNum);
			ShowQuestion();
		}
	}
	
	private function SubmitResults(){
		//This class will submit the results to the database
		/*
		Should be done calling a method of the GameLogic class
		*/
		
		Debug.Log("Exiting quiz. The former scores were " + PlayerPrefs.GetInt("PlayerScore") + " for the selected player and " +PlayerPrefs.GetInt("OpponentScore")+ " for the opponent.");
		
		var newplayerscore: int = playerScoreBoard.GetPoints();
		var newopponentscore: int = opponentScoreBoard.GetPoints();
		
		Debug.Log("Exiting quiz. The current scores are " + newplayerscore + " for the selected player and " + newopponentscore + " for the opponent.");
		
		PlayerPrefs.SetInt("PlayerScore", newplayerscore);
		PlayerPrefs.SetInt("OpponentScore", newopponentscore);
		
		//gameLogic.SubmitQuizResults(answers);
		var stringanswers : String;
		for(var an: int in answers){
			stringanswers = stringanswers + an.ToString() + ", ";
		}
		Debug.Log("The answers were: " + stringanswers);
		
		if (gameLogic.checkConnection()){			//If we are authenticated in the web service
			var firstTrack: JSONObject = new JSONObject();	//Sending the track to the database..
			firstTrack.Add("type", "logic");
			firstTrack.Add("event", "Quiz level number " + CurrentRoundNum + " score");
			firstTrack.Add("round", CurrentRoundNum.ToString());
			firstTrack.Add("score", stringanswers);
			var tracks : JSONObject[] = new JSONObject[1];
			tracks[0] = firstTrack;
			Debug.Log("Submitting quiz results to the database");
			gameLogic.db.Track(tracks);
		}
		else{
			Debug.LogError("Connection not established (sessionKey not found) when trying to post the first trace.");
		}
		
	}
	
}//End of class brace