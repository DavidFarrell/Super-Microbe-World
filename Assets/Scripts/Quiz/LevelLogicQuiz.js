#pragma strict

public class LevelLogicQuiz extends MonoBehaviour{
	
	/*This script is almost identical to the LevelLogicGameShow.js script. It's used to control the logic of the quiz scenes.*/
	
	private var TextFromXML: String = '<?xml version="1.0" encoding="utf-8" ?><round id="0">	<name>All About Microbes</name>	<round_id>0</round_id>	<next_round>alpha_gameshow_round2.xml</next_round>	<intro_text>		<blind>			<statement>Welcome to the first BLIND QUESTION ROUND!</statement>			<statement>I"m going to ask you some questions but I"m NOT going to tell you if you got them right!</statement>			<statement>If you got them right, you"ll get a great bonus later though so try your best.</statement>			<statment>Lets go!</statment>		</blind>		<normal>			<statement>Well done, you"re a hoverboard natural!</statement>			<statement>Now it"s time to ask you those questions again</statement>			<statement>This time, you get 10 points for a correct answer, but if you get it wrong, the other player gets points.</statement>			<statement>so if you DON"T KNOW the answer, it"s best to play it safe and say so!</statement>			<statement>Ready?</statement>			<statement>Let"s go!</statement>		</normal>	</intro_text>	<questions>		<question id="0">			<type>0</type>			<score>10</score>			<value>1</value>			<text>If you cannot see a microbe it is not there</text>			<answers>				<answer>					<label>Agree</label>					<value>-1</value>				</answer>				<answer>					<lable>Don"t Know</lable>					<value>0</value>				</answer>				<answer>					<lable>Disagree</lable>					<value>1</value>				</answer>			</answers>		</question>		<question id="1">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Bacteria and Viruses are the same</text>			<answers>				<answer>					<label>Agree</label>					<value>-1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>1</value>				</answer>			</answers>		</question>		<question id="2">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Fungi are microbes</text>			<answers>				<answer>					<label>Agree</label>					<value>1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>-1</value>				</answer>			</answers>		</question>		<question id="3">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Microbes are found on our hands</text>			<answers>				<answer>					<label>Agree</label>					<value>1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>-1</value>				</answer>			</answers>		</question>	</questions></round>';
	
	private var Round1 : Round;		//For development purposes. Will contain the parsed data from the xml string above
	
	private var gameHost : GameObject;
	private var playerAmy : GameObject;
	private var playerHarry : GameObject;
	
	private var player : String;
	
	private var amyAnim : Animator;
	private var harryAnim : Animator;
	private var hostAnim : Animator;
	
	private var amyScoreBoard : ScoreBoard;
	private var harryScoreBoard : ScoreBoard;
	
	private var formBackground : GameObject;
	
	private var textBoxGO : GameObject;
	private var textBox : TextBox;			//To have a reference to the TextBox class in order to use its functions
	
	private var gameLogic : GameLogic;
	
	private var levelStarted: boolean = false;		//This boolean is used to launch just once the sequencial part of the level from the Update() method
	
	private var blindMode: boolean = false;	//This boolean is to choose whether the game is going to be played on normal mode (false) or blind mode (true)
	
	private var CurrentQuestion: int = 0;
	private var TotalQuestions: int;
	//private var NextQuestion: int = ;
	
	function Awake () {
		
		gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
		
		//Save the references to the game objects of amy, hrry and the host
		playerAmy = GameObject.Find("amy");
		playerHarry = GameObject.Find("harry");
		gameHost = GameObject.Find("gamehost");
		
		formBackground = GameObject.Find("FormBackground");
		
		textBoxGO = GameObject.Find("TextBox");						//Keep a reference to the GameObject Text Box
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
		
		
		formBackground.SetActive(false);							//Disable the form background, which will be enabled when needed
		
		textBox = textBoxGO.GetComponent(TextBox);			//To have a reference to the TextBox class in order to use it
		
	}

	function Update () {
		
		if (!levelStarted){
			levelStarted = true;
			StartLevel();
		}
		
	}
	
	function TestXmlSerializer(){
	//This function is to test if the xml serializer works.
		
		Debug.Log("Starting to parse the xml...");
		
		//Round1 = new Round();
		Round1 = Round.LoadFromText(TextFromXML);
		
		Debug.Log("Parsed.");
		
		Debug.Log("Round id: " + Round1.id);
		Debug.Log("Name: " + Round1.name);
		Debug.Log("Round Id: " + Round1.round_id);
		Debug.Log("Next Round: " + Round1.next_round);
		
		var blindStatements: String = "";
		for(var blindStatement: String in Round1.intro_text.blind){
			blindStatements = blindStatements + "\n" + blindStatement;
		}
		Debug.Log("Intro text (blind statements): " + blindStatements);
		
		var normalStatements: String = "";
		for(var normalStatement: String in Round1.intro_text.normal){
			normalStatements = normalStatements + "\n" + normalStatement;
		}
		Debug.Log("Intro text: (normal statements)" + normalStatements);
		//Debug.Log("Questions: " + Round1.name);
	}
	
	private function StartLevel(){
		//This function will execute all the sequence of actions that have to be done during the level
		
		//First we load all the text of the introduction and the questions
		Round1 = Round.LoadFromText(TextFromXML);
		TotalQuestions = Round1.questions.Count;	//To keep the number of questions in this round
		Debug.Log("The number of questions is: " + TotalQuestions);
		/* These are the actions to perform:
		-Show the textBox with the welcome text
		-Repeat this:
			-Read first question
			-Show the screen to choose the answer (waiting for the player to click any key...)
			-Read your answer, check and inform if it was correct or NotRenamedAttribute
			-Do the same with the other player
		*/
		
		hostAnim.SetTrigger("excited");
		
		//blindMode = true;				//blindMode is False by default
		
		if(blindMode){
			yield textBox.SayThis("Game host", Round1.intro_text.blind);
		}else{
			yield textBox.SayThis("Game host", Round1.intro_text.normal);
		}
		
		
		
		//note that "question" is a class name, and quest is a variable
		for(var quest : Question in Round1.questions){
			Debug.Log("Question: " + quest.text);
			yield textBox.SayThis("Game host", quest.text);
//			ShowQuestion();
		}
		
//		ShowQuestion();
		
	}
	
//	private function ShowQuestion(){
//		/*This method will display the current question (which number is in the CurrentQuestion var) and the options to answer.
//		The idea is to call this method every time that we need to show the following question.
//		*/
//		
//		Debug.Log("The number of questions is: " + Round1.questions.questions.Count);
//		
//		var thisquestion: Question = Round1.questions.questions[CurrentQuestion];	//To keep the present question
//		
//		Debug.Log("Question : " + thisquestion.text);
//		
//		yield textBox.SayThis("Game host", thisquestion.text);	
//		
//		formBackground.SetActive(true);
//	}
	
}//End of class brace