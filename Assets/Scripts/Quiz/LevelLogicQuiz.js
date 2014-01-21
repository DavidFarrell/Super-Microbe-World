#pragma strict

public class LevelLogicQuiz extends MonoBehaviour{
	
	/*This script is almost identical to the LevelLogicGameShow.js script. It's used to control the logic of the quiz scenes.*/
	
	//TODO this script always loads the xml format string of the var below this comment. We'll have to change it to ask for the xml text using an http petition to the server with the WWW class of unity script and getting this information from the WWW.text field
	
	private var TextFromXML: String = '<?xml version="1.0" encoding="utf-8" ?><round id="0">	<name>All About Microbes</name>	<round_id>0</round_id>	<next_round>alpha_gameshow_round2.xml</next_round>	<intro_text>		<blind>			<statement>Welcome to the first BLIND QUESTION ROUND!</statement>			<statement>I"m going to ask you some questions but I"m NOT going to tell you if you got them right!</statement>			<statement>If you got them right, you"ll get a great bonus later though so try your best.</statement>			<statment>Lets go!</statment>		</blind>		<normal>			<statement>Well done, you"re a hoverboard natural!</statement>			<statement>Now it"s time to ask you those questions again</statement>			<statement>This time, you get 10 points for a correct answer, but if you get it wrong, the other player gets points.</statement>			<statement>so if you DON"T KNOW the answer, it"s best to play it safe and say so!</statement>			<statement>Ready?</statement>			<statement>Let"s go!</statement>		</normal>	</intro_text>	<questions>		<question id="0">			<type>0</type>			<score>10</score>			<value>1</value>			<text>If you cannot see a microbe it is not there</text>			<answers>				<answer>					<label>Agree</label>					<value>-1</value>				</answer>				<answer>					<lable>Don"t Know</lable>					<value>0</value>				</answer>				<answer>					<lable>Disagree</lable>					<value>1</value>				</answer>			</answers>		</question>		<question id="1">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Bacteria and Viruses are the same</text>			<answers>				<answer>					<label>Agree</label>					<value>-1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>1</value>				</answer>			</answers>		</question>		<question id="2">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Fungi are microbes</text>			<answers>				<answer>					<label>Agree</label>					<value>1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>-1</value>				</answer>			</answers>		</question>		<question id="3">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Microbes are found on our hands</text>			<answers>				<answer>					<label>Agree</label>					<value>1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>-1</value>				</answer>			</answers>		</question>	</questions></round>';
	
	private var CurrentRound : Round;		//For development purposes. Will contain the parsed data from the xml string above
	
	private var gameHost : GameObject;
	private var playerAmy : GameObject;
	private var playerHarry : GameObject;
	
	private var playerName : String;		//The name of the player in use will be loaded in the beginning
	
	private var amyAnim : Animator;
	private var harryAnim : Animator;
	private var hostAnim : Animator;
	
	private var amyScoreBoard : ScoreBoard;
	private var harryScoreBoard : ScoreBoard;
	
	private var playerScoreBoard : ScoreBoard;
	private var opponentScoreBoard : ScoreBoard;
	
	private var formBackground : GameObject;
	
	private var textBoxGO : GameObject;
	private var textBox : TextBox;			//To have a reference to the TextBox class in order to use its functions
	
	private var gameLogic : GameLogic;
	
	private var levelStarted: boolean = false;		//This boolean is used to launch just once the sequencial part of the level from the Update() method
	
	private var blindMode: boolean = false;	//This boolean is to choose whether the game is going to be played on normal mode (false) or blind mode (true)
	
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
		
		//Save the references to the game objects of amy, hrry and the host
		playerAmy = GameObject.Find("amy");
		playerHarry = GameObject.Find("harry");
		gameHost = GameObject.Find("gamehost");
		
		formBackground = GameObject.Find("FormBackground");
		
		textBoxGO = GameObject.Find("TextBox");						//Keep a reference to the GameObject Text Box
		
		answers = new List.<int>();			//To initialize the answers array
		
		if (PlayerPrefs.HasKey("player"))							//We'll instantiate amy or harry depending on which one was selected in the initial scene.
			playerName = PlayerPrefs.GetString("player");
		else{
			Debug.LogError("'player' attribute not found in the PlayerPrefs. Using Harry as default.");
			playerName = "harry";
		}
	}
	
	function Start () {
		
		//TestXmlSerializer();
		
		//Load the animators
		amyAnim = playerAmy.GetComponent(Animator);
		harryAnim = playerHarry.GetComponent(Animator);
		hostAnim = gameHost.GetComponent(Animator);
		
		//Save the references to the ScoreBoard.js scripts attached to Amy and Harry.
		amyScoreBoard = playerAmy.transform.GetComponent("ScoreBoard");
		harryScoreBoard = playerHarry.transform.GetComponent("ScoreBoard");
		
		if(playerName == "harry"){					//this will be neccesary to update the scoreboards
			playerScoreBoard = harryScoreBoard;
			opponentScoreBoard = amyScoreBoard;
		}else{
			playerScoreBoard = amyScoreBoard;
			opponentScoreBoard = harryScoreBoard;
		}
		
		formBackground.SetActive(false);							//Disable the form background, which will be enabled when needed
		
		textBox = textBoxGO.GetComponent(TextBox);			//To have a reference to the TextBox class in order to use it
		
	}

	function Update () {
		
		if (!levelStarted){
			levelStarted = true;
			StartLevel();
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
	
	function TestXmlSerializer(){
	//This function is to TEST if the xml serializer works.
		
		Debug.Log("Starting to parse the xml...");
		
		//CurrentRound = new Round();
		CurrentRound = Round.LoadFromText(TextFromXML);
		
		Debug.Log("Parsed.");
		
		Debug.Log("Round id: " + CurrentRound.id);
		Debug.Log("Name: " + CurrentRound.name);
		Debug.Log("Round Id: " + CurrentRound.round_id);
		Debug.Log("Next Round: " + CurrentRound.next_round);
		
		var blindStatements: String = "";
		for(var blindStatement: String in CurrentRound.intro_text.blind){
			blindStatements = blindStatements + "\n" + blindStatement;
		}
		Debug.Log("Intro text (blind statements): " + blindStatements);
		
		var normalStatements: String = "";
		for(var normalStatement: String in CurrentRound.intro_text.normal){
			normalStatements = normalStatements + "\n" + normalStatement;
		}
		Debug.Log("Intro text: (normal statements)" + normalStatements);
		//Debug.Log("Questions: " + CurrentRound.name);
	}
	
	private function StartLevel(){
		//This function will execute all the sequence of actions that have to be done during the level
		
		//First we load all the text of the introduction and the questions
		CurrentRound = Round.LoadFromText(TextFromXML);
		TotalQuestions = CurrentRound.questions.Count;	//To keep the number of questions in this round
		//Debug.Log("The number of questions is: " + TotalQuestions);
		/* These are the actions to perform:
		-Show the textBox with the welcome text
		-Repeat this:
			-Read first question
			-Show the screen to choose the answer (waiting for the player to click any key...)
			-Read your answer, check and inform if it was correct or not
			-Do the same with the other player
		*/
		
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
		
		Debug.Log("Question : " + CurrentQuestion.text);
		
		yield textBox.SayThis("Game host", CurrentQuestion.text);	
		
		amyScoreBoard.Disable();
		harryScoreBoard.Disable();
		formBackground.SetActive(true);
		
		formMode = true;
	}
	
	private function Answer(CurrentAnswer: String){
		//This function is called when some button in the form is pressed. The argument CurrentAnswer contains which button was pressed.
		//It checks if the answer was correct 
		
		Debug.Log("The user answered " + CurrentAnswer + " to the question number " + CurrentQuestionNum);
		
		amyScoreBoard.Enable();
		harryScoreBoard.Enable();
		formBackground.SetActive(false);
		formMode = false;
		
		//TODO play animations and write texts in the textbox
		
		/*Actions:
		-Check if the answer was wrong, right, or Don't know
		-Generate a random answer for the other player and check it
		-Make the gamehost communicate the results
		-update the scoreboards
		-Animate the characters to make them feel happy or dissappointed
		-Store the results
			-if it was the last answer of the round, send the results to the database
			-else, update CurrentQuestionNum and call ShowQuestion to ask the following question
		*/
		//Getting the punctuation of the player for this question
		var punctuation: int = CurrentQuestion.score * CurrentQuestion.Answers.Find(x => (x.Label == CurrentAnswer)).value_;	//The punctuation will be 0 if answered Don't know, +10 if clicked on the correct answer, and -10 if answered the wrong answer
		
		//Storing punctuation and updating the scoreboards
		playerScoreBoard.ChangePoints(punctuation);			//To update the scoreboard of the player (punctuation will be added to the old punctuation)
		if(punctuation>0){
			answers[CurrentQuestionNum] = 1;				//To store the answer
		}else{
			if(punctuation<0){
				answers[CurrentQuestionNum] = -1;
				opponentScoreBoard.ChangePoints(5);			//If the player fails its answer, the opponent will get an extra 5 points!
			}else{	//punctuation == 0
				answers[CurrentQuestionNum] = 0;			
			}
		}
		
		//Generating the answer of the other player
		var rndNum: int = Random.Range(0, 3);	//Will generate numbers between 0 and 2 (0 means that the opponent fail the question, 1, that he doesn't know and 2 that he answered the question correctly)
		switch(rndNum){
			case 0:		//opponent fails
				playerScoreBoard.ChangePoints(5);
				break;
			case 1:		//opponent doesn't know
				
				break;
			case 2:		//opponent answers correctly
				opponentScoreBoard.ChangePoints(CurrentQuestion.score);
				break;
		}
		
		CurrentQuestionNum++;
		if (CurrentQuestionNum == TotalQuestions){		//There's not any more questions in this round
			gameLogic.NextLevel();
		}
		else{									//Shows the next question
			ShowQuestion();
		}
	}
	
}//End of class brace