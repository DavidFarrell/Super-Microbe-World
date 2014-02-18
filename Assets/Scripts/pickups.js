#pragma strict

public var isSoap: boolean = false;
public var isWhiteBloodCell: boolean = false;
public var isAntibiotic: boolean = false;
public var AutoRespawn: boolean = true;
public var TimeToRespawn: int = 5;
public var UnitsAdded: int = 3;

private var hasCollidedAlready: boolean = false;
private var anim: Animator;

function Start () {
	//To control that just one of the three variables is set to true.
	if (isSoap){
		isWhiteBloodCell = false;
		isAntibiotic = false;
	}
	else{
		if(isWhiteBloodCell){
			isAntibiotic = false;
		}
	}
	
	hasCollidedAlready = false;
	anim = transform.GetComponent(Animator);
}

function Update () {
	
	
	
}

function RespawnPickup(){
	yield new WaitForSeconds(TimeToRespawn);
	hasCollidedAlready = false;
	transform.collider2D.enabled= true;
	transform.renderer.enabled = true;
}

function makeInvisible(){
	//transform.renderer.active = false;
}

function OnTriggerEnter2D (coll: Collider2D) {
	var objectCollided: GameObject = coll.gameObject;
	if(!hasCollidedAlready && objectCollided.layer == utils.layers.player){
		if(AutoRespawn) RespawnPickup();		//To create again the pickup
		
		makeInvisible();		//The drop won't be seen for a while, until is enabled again
		
//		Debug.Log("Collision with: " + objectCollided.name);
		
		if(objectCollided.layer == utils.layers.player){
			hasCollidedAlready = true;
			anim.SetTrigger("collide");			//Plays the collision animation
			Debug.Log("Trying to make the drop play the collide animation...");
			if(isSoap){
//				Debug.Log("soap");
				objectCollided.SendMessage("AddSoap", UnitsAdded, SendMessageOptions.RequireReceiver);
			}
			if(isWhiteBloodCell){
//				Debug.Log("wbc");
				objectCollided.SendMessage("AddWhiteBloodCells", UnitsAdded, SendMessageOptions.RequireReceiver);
			}
			if(isAntibiotic){
//				Debug.Log("antibiotics");
				objectCollided.SendMessage("AddAntibiotics", UnitsAdded, SendMessageOptions.RequireReceiver);
			}
		}
	}
}