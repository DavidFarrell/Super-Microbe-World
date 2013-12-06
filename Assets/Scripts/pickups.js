#pragma strict

public var isSoap: boolean = false;
public var isWhiteBloodCell: boolean = false;
public var isAntibiotic: boolean = false;

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

function OnTriggerEnter2D (coll: Collider2D) {
	if(!hasCollidedAlready){
		Destroy(gameObject, 0.2);								//Destroys the drop 0.1 seconds after playing the "collision" animation
		hasCollidedAlready = true;
		
		var objectCollided: GameObject = coll.gameObject;
//		Debug.Log("Collision with: " + objectCollided.name);
		
		if(objectCollided.layer == utils.layers.player){
			hasCollidedAlready = true;
			anim.SetTrigger("collide");			//Plays the collision animation
			if(isSoap){
//				Debug.Log("soap");
				objectCollided.SendMessage("AddSoap", 1, SendMessageOptions.RequireReceiver);
			}
			if(isWhiteBloodCell){
//				Debug.Log("wbc");
				objectCollided.SendMessage("AddWhiteBloodCells", 1, SendMessageOptions.RequireReceiver);
			}
			if(isAntibiotic){
//				Debug.Log("antibiotics");
				objectCollided.SendMessage("AddAntibiotics", 1, SendMessageOptions.RequireReceiver);
			}
		}
	}
}